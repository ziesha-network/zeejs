function PublicKey(point) {
  this.point = point.affine();
}

PublicKey.prototype.toString = function() {
  let is_odd = this.point.y.value % BigInt(2) == 1;
  let hex = this.point.x.value.toString(16);
  let addr = 'z' + (is_odd ? '3' : '2') + '0'.repeat(64 - hex.length) + hex;
  return addr;
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

let sk = new PrivateKey([104, 101, 108, 108, 111]);
let sig = sk.sign(new Field(123));
alert(sk.pub_key.verify(new Field(123), sig));
