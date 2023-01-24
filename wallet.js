function PublicKey(point) {
  this.point = point.affine();
}

PublicKey.prototype.toString = function() {
  let is_odd = this.point.y.value % BigInt(2) == 1;
  let hex = this.point.x.value.toString(16);
  let addr = 'z' + (is_odd ? '3' : '2') + '0'.repeat(64 - hex.length) + hex;
  return addr;
}

PublicKey.fromString = function(s) {
  if(s.length != 66 || s[0] != "z" || (s[1] != "2" && s[1] != "3")) {
    throw Error("Invalid mpn address!");
  }
  let is_odd = s[1] == "3";
  let x = new Field('0x' + s.slice(2));
  var y = (new Field(1)).sub(D.mul(x.mul(x))).invert().mul((new Field(1).sub(A.mul(x).mul(x))));
  y = y.sqrt();
  let y_is_odd = y.value % BigInt(2) == 1;
  if(y_is_odd != is_odd) {
      y = y.neg();
  }
  return new PublicKey(new Point(x, y));
}

function sha3(inp) {
  let output = sha3_256(inp);
  let rev_output = output.match(/[a-fA-F0-9]{2}/g).reverse().join('');
  return new Field(BigInt('0x' + rev_output));
}

function Signature(r, s) {
  this.r = r;
  this.s = s;
}

Signature.prototype.hex = function() {
  function ser(f) {
    var hex = f.montgomery().value.toString(16);
    hex = "0".repeat(64 - hex.length) + hex;
    return hex.match(/[a-fA-F0-9]{2}/g).reverse().join('');
  }
  return ser(this.r.x) + ser(this.r.y) + ser(this.s);
}

function PrivateKey(seed) {
  this.randomness = sha3(seed);
  this.scalar = sha3(this.randomness.bytes());
  this.pub_key = new PublicKey(BASE.mul(this.scalar));
}

PrivateKey.prototype.sign = function(msg) {
  // r=H(b,M)
  let r = poseidon2(this.randomness, msg);

  // R=rB
  let rr = BASE.mul(r).affine();

  // h=H(R,A,M)
  let h = poseidon5(rr.x, rr.y, this.pub_key.point.x, this.pub_key.point.y, msg);

  // s = (r + ha) mod ORDER
  let ha = h.value * this.scalar.value;
  let s = new Field((r.value + ha) % ORDER);

  return new Signature(rr, s);
}

PublicKey.prototype.mpn_account_index = function() {
  return Number(this.point.x.value & BigInt(0x3fffffff));
}

PublicKey.prototype.verify = function(msg, sig) {
  if(!this.point.isOnCurve() || !sig.r.isOnCurve()) {
    return false;
  }

  // h=H(R,A,M)
  let h = poseidon5(sig.r.x, sig.r.y, this.point.x, this.point.y, msg);

  let sb = BASE.mul(sig.s);

  let r_plus_ha = this.point.mul(h).add(sig.r);

  return r_plus_ha.equals(sb);
}

PrivateKey.prototype.create_tx = function(nonce, to, amount, fee) {
  let tx_hash = poseidon7(
    new Field(nonce),
    to.point.x,
    to.point.y,
    new Field(1),
    new Field(amount),
    new Field(1),
    new Field(fee)
  );
  let sig = this.sign(tx_hash);
  return {
    "nonce": nonce,
    "src_pub_key": this.pub_key.toString(),
    "dst_pub_key": to.toString(),
    "src_token_index": 0,
    "src_fee_token_index": 0,
    "dst_token_index": 0,
    "amount_token_id" :"Ziesha",
    "fee_token_id" :"Ziesha",
    "amount": amount,
    "fee": fee,
    "sig": sig.hex()
  };
}

var STATE = {sk: null, account: null};
let NODE = "65.108.193.133:8765";
let NETWORK = 'chay-4';

async function getAccount(pub_key) {
  return fetch('http://' + NODE + '/mpn/account?index=' + pub_key.mpn_account_index(), {
      method: 'GET',
      headers: {
          'X-ZIESHA-NETWORK-NAME': NETWORK,
          'Accept': 'application/json'
      },
  })
  .then(response => response.json());
}

async function sendTx(tx) {
  return fetch('http://' + NODE + '/transact/zero', {
      method: 'POST',
      headers: {
          'X-ZIESHA-NETWORK-NAME': NETWORK,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
      },
      body: JSON.stringify({tx: tx})
  })
  .then(response => response.text());
}

function render() {
  if(STATE.sk === null) {
    document.getElementById("content").innerHTML = `
      <form onsubmit="login(event)">
        <div style="text-align:center"><input placeholder="12-word seed phrase" id="mnemonic" type="text" name="mnemonic"/></div>
        <div style="text-align:center"><button>Login!</button></div>
        <div style="text-align:center;">(No seed phrase yet? <a onclick="generatePhrase(event)">Generate a new seed phrase!</a>)</div>
      </form>
      `;
  }
  else {
    let html = "";
    if(STATE.account !== null) {
      html += '<p style="text-align:center"><b>Address:</b><br>' + STATE.sk.pub_key + "</p>";
      var balance = "0.0";
      if((0 in STATE.account.tokens) && STATE.account.tokens[0].token_id == "Ziesha") {
        balance = (STATE.account.tokens[0].amount / 1000000000).toString();
      }
      if(!balance.includes('.')) {
        balance += ".0";
      }

      html += '<p style="text-align:center"><b>Balance:</b><br>' + balance + "<b>ℤ</b></p>";
    }
    html += `
    <form onsubmit="event.preventDefault()">
      <div><input placeholder="To:" type="text" name="to" id="to"/></div>
      <div><input placeholder="Amount:" type="number" name="amount" id="amount"/></div>
      <div><input placeholder="Fee:" type="number" name="fee" id="fee"/></div>
      <div style="text-align:center">
        <button onclick="send(event)">Send!</button>
        <button onclick="logout(event)">Logout!</button>
        <button onclick="clearHistory(event)">Clear history!</button>
      </div>
    </form>
      `;
      if(STATE.account !== null) {
        let hist = getHistory();
        let pendings = [];
        for(i in hist) {
          if(hist[i]["nonce"] >= STATE.account.nonce) {
            pendings.push(hist[i])
          }
        }
        if(pendings.length > 0) {
          html += '<p style="text-align:center;font-size:0.9em"><b>Pending transactions:</b><br>'
          for(i in pendings) {
            html += 'Send ' + pendings[i]["amount"] / 1000000000 + 'ℤ to ' + pendings[i]["dst_pub_key"] +'<br>';
          }
          html += "</p>"
          html += '<div style="text-align:center"><button onclick="resendPendings(event)">Resend pendings</button>';
        }
      }
      document.getElementById("content").innerHTML = html;
  }
}

async function login(event) {
  event.preventDefault();
  let mnemonic = document.getElementById("mnemonic").value;
  STATE.sk = new PrivateKey(toSeed(mnemonic));
  STATE.account = (await getAccount(STATE.sk.pub_key)).account;
  render();
}

async function logout(event) {
  event.preventDefault();
  STATE.sk = null;
  render();
}

function getHistory() {
  let val = localStorage.getItem("txs");
  if(val === null) {
    return [];
  } else {
    return JSON.parse(val);
  }
}

function addTx(tx) {
  let hist = getHistory();
  hist.push(tx);
  localStorage.setItem("txs", JSON.stringify(hist));
}

async function send(event) {
  event.preventDefault();
  let nonce = STATE.account.nonce;
  let hist = getHistory();
  for(i in hist) {
    if(hist[i]["nonce"] >= nonce) {
      nonce = hist[i]["nonce"] + 1;
    }
  }
  let to = PublicKey.fromString(document.getElementById("to").value);
  if(to.toString() == STATE.sk.pub_key.toString()) {
    alert("Cannot send to yourself!");
  }
  let amount = Math.floor(Number(document.getElementById("amount").value) * 1000000000);
  let fee = Math.floor(Number(document.getElementById("fee").value) * 1000000000);
  let tx = STATE.sk.create_tx(nonce, to, amount, fee);
  addTx(tx);

  await sendTx(tx);

  render();
}

async function resendPendings(event) {
  let hist = getHistory();
  let nonce = STATE.account.nonce;
  for(i in hist) {
    if(hist[i]["nonce"] >= nonce) {
      await sendTx(hist[i]);
    }
  }

  render();
}

function clearHistory(event) {
  event.preventDefault();
  localStorage.setItem("txs", JSON.stringify([]));
  render();
}

function generatePhrase(event) {
  document.getElementById("mnemonic").value = newPhrase();
}

render();
