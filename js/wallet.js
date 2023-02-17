function PublicKey(point) {
  this.point = point.affine();
}

PublicKey.prototype.toString = function () {
  let is_odd = this.point.y.value % BigInt(2) == 1;
  let hex = this.point.x.value.toString(16);
  let addr = "z" + (is_odd ? "3" : "2") + "0".repeat(64 - hex.length) + hex;
  return addr;
};

PublicKey.fromString = function (s) {
  if (s.length != 66 || s[0] != "z" || (s[1] != "2" && s[1] != "3")) {
    throw Error("Invalid mpn address!");
  }
  let is_odd = s[1] == "3";
  let x = new Field("0x" + s.slice(2));
  var y = new Field(1)
    .sub(D.mul(x.mul(x)))
    .invert()
    .mul(new Field(1).sub(A.mul(x).mul(x)));
  y = y.sqrt();
  let y_is_odd = y.value % BigInt(2) == 1;
  if (y_is_odd != is_odd) {
    y = y.neg();
  }
  return new PublicKey(new Point(x, y));
};

function sha3(inp) {
  let output = sha3_256(inp);
  let rev_output = output
    .match(/[a-fA-F0-9]{2}/g)
    .reverse()
    .join("");
  return new Field(BigInt("0x" + rev_output));
}

function Signature(r, s) {
  this.r = r;
  this.s = s;
}

Signature.prototype.hex = function () {
  function ser(f) {
    var hex = f.montgomery().value.toString(16);
    hex = "0".repeat(64 - hex.length) + hex;
    return hex
      .match(/[a-fA-F0-9]{2}/g)
      .reverse()
      .join("");
  }
  return ser(this.r.x) + ser(this.r.y) + ser(this.s);
};

function PrivateKey(seed) {
  this.randomness = sha3(seed);
  this.scalar = sha3(this.randomness.bytes());
  this.pub_key = new PublicKey(BASE.mul(this.scalar));
}

PrivateKey.prototype.sign = function (msg) {
  // r=H(b,M)
  let r = poseidon2(this.randomness, msg);

  // R=rB
  let rr = BASE.mul(r).affine();

  // h=H(R,A,M)
  let h = poseidon5(
    rr.x,
    rr.y,
    this.pub_key.point.x,
    this.pub_key.point.y,
    msg
  );

  // s = (r + ha) mod ORDER
  let ha = h.value * this.scalar.value;
  let s = new Field((r.value + ha) % ORDER);

  return new Signature(rr, s);
};

PublicKey.prototype.mpn_account_index = function () {
  return Number(this.point.x.value & BigInt(0x3fffffff));
};

PublicKey.prototype.verify = function (msg, sig) {
  if (!this.point.isOnCurve() || !sig.r.isOnCurve()) {
    return false;
  }

  // h=H(R,A,M)
  let h = poseidon5(sig.r.x, sig.r.y, this.point.x, this.point.y, msg);

  let sb = BASE.mul(sig.s);

  let r_plus_ha = this.point.mul(h).add(sig.r);

  return r_plus_ha.equals(sb);
};

PrivateKey.prototype.create_tx = function (
  nonce,
  to,
  amount,
  fee,
  tokenId,
  srcTokenIndex,
  dstTokenIndex
) {
  var tokenIdBigInt = BigInt(1);
  if(tokenId != "Ziesha") {
    tokenIdBigInt = BigInt(tokenId);
  }
  let tx_hash = poseidon7(
    new Field(nonce),
    to.point.x,
    to.point.y,
    new Field(tokenIdBigInt),
    new Field(amount),
    new Field(1),
    new Field(fee)
  );
  let sig = this.sign(tx_hash);
  return {
    nonce: nonce,
    src_pub_key: this.pub_key.toString(),
    dst_pub_key: to.toString(),
    src_token_index: srcTokenIndex,
    src_fee_token_index: 0,
    dst_token_index: dstTokenIndex,
    amount_token_id: tokenId,
    fee_token_id: "Ziesha",
    amount: amount,
    fee: fee,
    sig: sig.hex(),
  };
};

var STATE = { sk: null, account: null };
let NODE = "213.14.138.127:8765";
let NETWORK = "pelmeni-6";
let POOLS = [
  "213.14.138.127:8765",
  "117.62.66.67:8765",
  "110.186.73.243:8765",
  "89.179.68.98:8765",
  "95.161.216.108:8765",
  "93.157.251.188:8765",
];

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 2000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

async function getAccount(pub_key) {
  return fetch(
    "http://" + NODE + "/mpn/account?index=" + pub_key.mpn_account_index(),
    {
      method: "GET",
      headers: {
        "X-ZIESHA-NETWORK-NAME": NETWORK,
        Accept: "application/json",
      },
    }
  )
    .then((response) => response.text())
    .then((txt) => parseWithBigInt(txt));
}

const isBigNumber = (num) => !Number.isSafeInteger(+num);

const enquoteBigNumber = (jsonString) =>
  jsonString.replaceAll(
    /([:\s\[,]*)(\d+)([\s,\]]*)/g,
    (matchingSubstr, prefix, bigNum, suffix) =>
      isBigNumber(bigNum) ? `${prefix}"${bigNum}"${suffix}` : matchingSubstr
  );

const parseWithBigInt = (jsonString) =>
  JSON.parse(enquoteBigNumber(jsonString), (key, value) =>
    !isNaN(value) && isBigNumber(value) ? BigInt(value) : value
  );

function parseTokenId(id) {
  if (id.Custom == undefined) {
    return "Ziesha";
  } else {
    var n = BigInt(id.Custom[3]);
    n = n << BigInt(64);
    n += BigInt(id.Custom[2]);
    n = n << BigInt(64);
    n += BigInt(id.Custom[1]);
    n = n << BigInt(64);
    n += BigInt(id.Custom[0]);
    let r_inv = new Field(MODULUS_R).invert();
    n = new Field(n * r_inv.value);
    var hex = n.value.toString(16);
    hex = "0".repeat(64 - hex.length) + hex;
    return "0x" + hex;
  }
}

async function getToken(id) {
  return fetch("http://" + NODE + "/token?token_id=" + id, {
    method: "GET",
    headers: {
      "X-ZIESHA-NETWORK-NAME": NETWORK,
      Accept: "application/json",
    },
  }).then((response) => response.json());
}

async function getMempool(addr) {
  return fetch("http://" + NODE + "/mempool?mpn_address=" + addr, {
    method: "GET",
    headers: {
      "X-ZIESHA-NETWORK-NAME": NETWORK,
      Accept: "application/json",
    },
  }).then((response) => response.json());
}

async function sendTx(tx) {
  var tasks = [];
  for (i in POOLS) {
    tasks.push(
      fetchWithTimeout("http://" + POOLS[i] + "/transact/zero", {
        method: "POST",
        headers: {
          "X-ZIESHA-NETWORK-NAME": NETWORK,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ tx: tx }),
      }).then((response) => response.text())
    );
  }
  return Promise.all(tasks);
}

function render() {
  if (STATE.sk === null) {
    document.getElementById("content").innerHTML = `
      <form autocomplete="off" onsubmit="login(event)">
        <div style="text-align:center"><input placeholder="12-word seed phrase" id="mnemonic" type="text" name="mnemonic"/></div>
        <div style="text-align:center"><button>Login!</button></div>
        <div style="text-align:center;">(No seed phrase yet? <a onclick="generatePhrase(event)">Generate a new seed phrase!</a>)</div>
      </form>
      `;
  } else {
    let html = "";
    let tokens = {};
    let pendings = [];
    let spent = 0;

    if (STATE.account !== null) {
      let hist = getHistory(STATE.sk.pub_key);
      for (i in hist) {
        if (hist[i]["nonce"] >= STATE.account.nonce) {
          spent += hist[i]["amount"];
          pendings.push(hist[i]);
        }
      }
      html += "<div id='icon' style='text-align:center'></div>";
      html +=
        '<p style="text-align:center"><b>Address:</b><br>' +
        STATE.sk.pub_key +
        "</p>";
      html +=
        '<p style="text-align:center"><b>Nonce:</b> ' +
        STATE.account.nonce +
        "</p>";
      var balance = (Number(STATE.account.ziesha) / 1000000000).toString();
      if (!balance.includes(".")) {
        balance += ".0";
      }

      for (t in STATE.account.tokens) {
        tokens[t] = STATE.account.tokens[t] + " " + STATE.token_info[t].symbol;
      }

      tokens["Ziesha"] = balance + "ℤ";

      html +=
        '<p style="text-align:center"><b>Balance:</b> ' +
        balance +
        "<b>ℤ</b> <span style='font-size: 0.8em'>(<a onclick='load()'>Refresh...</a>)</span></p>";
    }
    html += `
    <form onsubmit="event.preventDefault()">
      <div><select id="token" name="token">`;
    for (tkn in tokens) {
      html +=
        '<option value="' +
        tkn +
        '">' +
        STATE.token_info[tkn].name +
        ' <i style="font-size:0.6em">(' +
        tokens[tkn] +
        ")</i></option>";
    }
    html += `</select></div>
      <div><input placeholder="To:" type="text" name="to" id="to"/></div>
      <div><input placeholder="Amount:" type="number" name="amount" id="amount"/></div>
      <div style="text-align:center">
        <button onclick="send(event)">Send!</button>
        <button onclick="logout(event)">Logout!</button>
        <button onclick="clearHistory(event)">Clear history!</button>
        <button onclick="showSeed(event)">Show seed!</button>
      </div>
    </form>
      `;
    if (STATE.account !== null) {
      if (pendings.length > 0) {
        html +=
          '<p style="text-align:center;font-size:0.9em"><b>Pending transactions:</b><br>';
        for (i in pendings) {
          let amnt = pendings[i]["amount"];
          if (pendings[i]["amount_token_id"] == "Ziesha") {
            amnt = amnt / 1000000000;
          }
          html +=
            "Send " +
            amnt +
            " " +
            STATE.token_info[pendings[i]["amount_token_id"]].symbol +
            " to " +
            pendings[i]["dst_pub_key"] +
            "<br>";
        }
        html += "</p>";
        html +=
          '<div style="text-align:center"><button onclick="resendPendings(event)">Resend pendings</button>';
      }
      var incomings = [];
      var outgoings = [];
      for (i in STATE.mempool["updates"]) {
        if (STATE.mempool["updates"][i]["dst_pub_key"] == STATE.sk.pub_key) {
          incomings.push(STATE.mempool["updates"][i]);
        } else if (STATE.mempool["updates"][i]["src_pub_key"] == STATE.sk.pub_key) {
          outgoings.push(STATE.mempool["updates"][i]);
        }
      }
      if (incomings.length > 0) {
        html +=
          '<p style="text-align:center;font-size:0.9em"><b>Incoming transactions:</b><br>';
        for (i in incomings) {
          var amnt = incomings[i]["amount"];
          var tkn = "(Unknown token)";
          if (incomings[i]["amount_token_id"] == "Ziesha") {
            amnt = amnt / 1000000000;
            tkn = "ℤ";
          }

          html +=
            "Getting " +
            amnt +
            tkn +
            " " +
            " From " +
            incomings[i]["src_pub_key"] +
            "<br>";
        }
        html += "</p>";
      }
      if (outgoings.length > 0) {
        html +=
          '<p style="text-align:center;font-size:0.9em"><b>Outgoing transactions:</b><br>';
        for (i in outgoings) {
          var amnt = outgoings[i]["amount"];
          var tkn = "(Unknown token)";
          if (outgoings[i]["amount_token_id"] == "Ziesha") {
            amnt = amnt / 1000000000;
            tkn = "ℤ";
          }

          html +=
            "Sending " +
            amnt +
            tkn +
            " " +
            " To " +
            outgoings[i]["dst_pub_key"] + " <i>(Nonce: " + outgoings[i]["nonce"] + ")</i>" +
            "<br>";
        }
        html += "</p>";
      }
    }
    document.getElementById("content").innerHTML = html;
    /*if (STATE.account !== null) {
      var icon = blockies.create({
        seed: STATE.sk.pub_key.toString(),
        size: 15,
        scale: 6,
        bgcolor: "#000",
      });
      document.getElementById("icon").appendChild(icon); // icon is a canvas element
    }*/
  }
}

function Account(acc) {
  this.nonce = acc.nonce;
  if (0 in acc.tokens && acc.tokens[0].token_id == "Ziesha") {
    this.ziesha = BigInt(acc.tokens[0].amount);
  } else {
    this.ziesha = BigInt(0);
  }
  this.tokens = {};
  this.token_to_index = {};
  this.index_to_token = {};
  for (ind in acc.tokens) {
    let tkn_id = parseTokenId(acc.tokens[ind].token_id);
    if (!(tkn_id in this.tokens)) {
      this.tokens[tkn_id] = acc.tokens[ind].amount;
      this.token_to_index[tkn_id] = parseInt(ind);
      this.index_to_token[parseInt(ind)] = tkn_id;
    }
  }
}

Account.prototype.findTokenIndex = function (tknId, allowEmpty) {
  if (tknId == "Ziesha") {
    return 0;
  }
  if (tknId in this.token_to_index) {
    return this.token_to_index[tknId];
  } else {
    if (allowEmpty) {
      for (i = 1; i < 64; i++) {
        if (this.index_to_token[i] === undefined) {
          return i;
        }
      }
    } else {
      throw Error("Token not found!");
    }
  }
};

async function load() {
  let mnemonic = localStorage.getItem("mnemonic");
  document.getElementById("modal").innerHTML = "<p>Loading...</p>";
  document
    .getElementById("modal-back")
    .style.setProperty("visibility", "visible");
  if (mnemonic != null) {
    try {
      STATE.sk = new PrivateKey(toSeed(mnemonic));
      STATE.account = new Account((await getAccount(STATE.sk.pub_key)).account);
      STATE.token_info = { Ziesha: { name: "Ziesha", symbol: "ℤ" } };
      for (tkn in STATE.account.tokens) {
        STATE.token_info[tkn] = (await getToken(tkn))["token"];
      }
      STATE.mempool = await getMempool(STATE.sk.pub_key);
      modalOk();
    } catch (e) {
      localStorage.removeItem("mnemonic");
      STATE.sk = null;
      STATE.account = null;
      alert(e);
    }
  } else {
    modalOk();
  }
  render();
}

async function login(event) {
  event.preventDefault();
  let mnemonic = document.getElementById("mnemonic").value;
  localStorage.setItem("mnemonic", mnemonic);
  document.getElementById("modal").innerHTML = "<p>Loading...</p>";
  document
    .getElementById("modal-back")
    .style.setProperty("visibility", "visible");
  await load();
}

async function logout(event) {
  event.preventDefault();
  localStorage.removeItem("mnemonic");
  clearHistory(event);
  STATE.sk = null;
  render();
}

function showSeed(event) {
  event.preventDefault();
  let mnemonic = localStorage.getItem("mnemonic");
  alert(
    "<span style='font-size:0.9em'>Your seed is:</span><br><br><b>" +
      mnemonic +
      "</b>"
  );
}

function getHistory(pub_key) {
  let val = localStorage.getItem(pub_key.toString());
  if (val === null) {
    return [];
  } else {
    return JSON.parse(val);
  }
}

function addTx(pub_key, tx) {
  let hist = getHistory(pub_key);
  hist.push(tx);
  localStorage.setItem(pub_key.toString(), JSON.stringify(hist));
}

function modalOk() {
  document
    .getElementById("modal-back")
    .style.setProperty("visibility", "hidden");
}

function alert(msg) {
  document.getElementById("modal").innerHTML =
    "<p>" + msg + "</p><button onclick='modalOk()'>Ok!</button>";
  document
    .getElementById("modal-back")
    .style.setProperty("visibility", "visible");
}

async function acceptSendTx(event) {
  event.preventDefault();
  addTx(STATE.sk.pub_key, STATE.tx_to_send);
  try {
    await sendTx(STATE.tx_to_send);
  } catch (e) {}
  modalOk();
  render();
}

async function send(event) {
  event.preventDefault();
  let nonce = STATE.account.nonce;
  let hist = getHistory(STATE.sk.pub_key);
  for (i in hist) {
    if (hist[i]["nonce"] >= nonce) {
      nonce = hist[i]["nonce"] + 1;
    }
  }
  try {
    let toValue = document.getElementById("to").value;
    let amountValue = document.getElementById("amount").value;
    let tokenValue = document.getElementById("token").value;
    if (!toValue) {
      throw Error("Address cannot be empty!");
    }
    let to = PublicKey.fromString(toValue);
    if (to.toString() == STATE.sk.pub_key.toString()) {
      throw Error("Cannot send to yourself!");
    } else {
      if (!amountValue) {
        throw Error("Amount cannot be empty!");
      }
      let amount = Math.floor(
        Number(amountValue) * (tokenValue == "Ziesha" ? 1000000000 : 1)
      );
      let dstAcc = new Account((await getAccount(to)).account);
      if (tokenValue != "Ziesha" || BigInt(amount) <= STATE.account.ziesha) {
        let tx = STATE.sk.create_tx(
          nonce,
          to,
          amount,
          0,
          tokenValue,
          STATE.account.findTokenIndex(tokenValue, false),
          dstAcc.findTokenIndex(tokenValue, true)
        );
        STATE.tx_to_send = tx;
        document.getElementById("modal").innerHTML =
          "<p>You are going to send " +
          amountValue +
          " " +
          STATE.token_info[tokenValue].symbol +
          " to:<br>" +
          to.toString() +
          "!</p><button onclick='acceptSendTx(event)'>Send!</button><button onclick='modalOk()'>Cancel</button>";
        document
          .getElementById("modal-back")
          .style.setProperty("visibility", "visible");
      } else {
        throw Error("Balance insufficient!");
      }
    }
  } catch (e) {
    alert(e);
  }

  render();
}

async function resendPendings(event) {
  let hist = getHistory(STATE.sk.pub_key);
  let nonce = STATE.account.nonce;
  for (i in hist) {
    if (hist[i]["nonce"] >= nonce) {
      await sendTx(hist[i]);
    }
  }

  render();
}

function clearHistory(event) {
  event.preventDefault();
  localStorage.setItem(STATE.sk.pub_key.toString(), JSON.stringify([]));
  render();
}

function generatePhrase(event) {
  document.getElementById("mnemonic").value = newPhrase();
}

load();
