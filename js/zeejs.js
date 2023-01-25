const MODULUS = BigInt(
  "52435875175126190479447740508185965837690552500527637822603658699938581184513"
);
const MODULUS_R = BigInt(
  "10920338887063814464675503992315976177888879664585288394250266608035967270910"
);

function Field(val) {
  this.value = ((BigInt(val) % MODULUS) + MODULUS) % MODULUS;
}

Field.prototype.isZero = function () {
  return this.value == BigInt(0);
};

function egcd(a, b) {
  if (a == 0) {
    return [b, BigInt(0), BigInt(1)];
  } else {
    let [g, y, x] = egcd(b % a, a);
    return [g, x - (b / a) * y, y];
  }
}

Field.prototype.invert = function () {
  let [g, x, y] = egcd(BigInt(this.value), BigInt(MODULUS));
  if (g != 1) {
    throw new Error("modular inverse does not exist");
  } else {
    return new Field(x % MODULUS);
  }
};

Field.prototype.bytes = function () {
  var value = BigInt(this.value);
  var bytes = [];
  for (i = 0; i < 32; i++) {
    bytes.push(Number(value % BigInt(256)));
    value = value / BigInt(256);
  }
  return bytes;
};

Field.prototype.equals = function (other) {
  return this.value == other.value;
};

Field.prototype.double = function () {
  return new Field(this.value + this.value);
};

Field.prototype.square = function () {
  return new Field(this.value * this.value);
};

Field.prototype.neg = function () {
  return new Field(MODULUS - this.value);
};

Field.prototype.add = function (other) {
  return new Field(this.value + other.value);
};

Field.prototype.sub = function (other) {
  return new Field(this.value - other.value);
};

Field.prototype.mul = function (other) {
  return new Field(this.value * other.value);
};

Field.prototype.pow = function (other) {
  var result = new Field(1);
  let init = new Field(this.value);
  let bits = other.toString(2);
  for (var i = 0; i < bits.length; i++) {
    result = result.mul(result);
    if (bits.charAt(i) == "1") {
      result = result.mul(init);
    }
  }
  return result;
};

Field.prototype.toString = function () {
  return this.value.toString();
};

Field.prototype.legendreSymbol = function () {
  let ls = this.pow((MODULUS - BigInt(1)) / BigInt(2));
  if (ls.value == MODULUS - BigInt(1)) {
    return BigInt(-1);
  } else {
    return ls.value;
  }
};

Field.prototype.sqrt = function () {
  if (this.legendreSymbol() != 1 || this.value == 0) {
    throw new Error("Square-root doesn't exist!");
  }
  var s = MODULUS - BigInt(1);
  var e = BigInt(0);
  while (s % BigInt(2) == 0) {
    s /= BigInt(2);
    e += BigInt(1);
  }
  var n = new Field(2);
  while (n.legendreSymbol() != -1) {
    n = n.add(new Field(1));
  }

  var x = this.pow((s + BigInt(1)) / BigInt(2)).value;
  var b = this.pow(s).value;
  var g = n.pow(s).value;
  var r = BigInt(e);

  while (true) {
    t = b;
    for (m = BigInt(0); m < r; m++) {
      if (t == 1) break;
      t = (t * t) % MODULUS;
    }

    if (m == 0) {
      return new Field(x);
    }

    var gs = new Field(g).pow(BigInt(2) ** (r - m - BigInt(1))).value;
    g = (gs * gs) % MODULUS;
    x = (x * gs) % MODULUS;
    b = (b * g) % MODULUS;
    r = m;
  }
  return new Field(n);
};

Field.prototype.montgomery = function () {
  return new Field(this.value * MODULUS_R);
};

function Point(x, y, z) {
  this.x = x;
  this.y = y;
  if (typeof z == "undefined") {
    this.z = new Field(1);
  } else {
    this.z = z;
  }
}

const A = new Field(-1);
const BASE = new Point(
  new Field(
    "28867639725710769449342053336011988556061781325688749245863888315629457631946"
  ),
  new Field("18")
);
const D = new Field(
  "19257038036680949359750312669786877991949435402254120286184196891950884077233"
);
const ORDER = BigInt(
  "6554484396890773809930967563523245729705921265872317281365359162392183254199"
);

Point.prototype.toString = function () {
  return (
    "(" +
    this.x.toString() +
    ", " +
    this.y.toString() +
    ", " +
    this.z.toString() +
    ")"
  );
};

Point.prototype.isZero = function () {
  return this.z.isZero();
};

Point.prototype.isOnCurve = function () {
  let lhs = this.y.mul(this.y).sub(this.x.mul(this.x));
  let rhs = D.mul(this.x).mul(this.x).mul(this.y).mul(this.y).add(new Field(1));
  return lhs.value == rhs.value;
};

Point.prototype.affine = function () {
  let z_inv = this.z.invert();
  return new Point(this.x.mul(z_inv), this.y.mul(z_inv), new Field(1));
};

Point.prototype.equals = function (other) {
  return (
    this.x.mul(other.z).equals(other.x.mul(this.z)) &&
    this.y.mul(other.z).equals(other.y.mul(this.z))
  );
};

Point.prototype.add = function (other) {
  if (this.isZero()) {
    return new Point(other.x, other.y, other.z);
  }
  if (other.isZero()) {
    return new Point(this.x, this.y, this.z);
  }

  let a = this.z.mul(other.z); // A = Z1 * Z2
  let b = a.square(); // B = A^2
  let c = this.x.mul(other.x); // C = X1 * X2
  let d = this.y.mul(other.y); // D = Y1 * Y2
  let e = D.mul(c).mul(d); // E = dC · D
  let f = b.sub(e); // F = B − E
  let g = b.add(e); // G = B + E

  return new Point(
    a.mul(f).mul(this.x.add(this.y).mul(other.x.add(other.y)).sub(c).sub(d)),
    a.mul(g).mul(d.sub(A.mul(c))),
    f.mul(g)
  );
};

Point.prototype.mul = function (scalar) {
  var result = Point.zero();
  let init = new Point(this.x, this.y, this.z);
  let bits = scalar.value.toString(2);
  for (var i = 0; i < bits.length; i++) {
    result = result.double();
    if (bits.charAt(i) == "1") {
      result = result.add(init);
    }
  }
  return result;
};

Point.prototype.double = function (other) {
  if (this.isZero()) {
    return Point.zero();
  }
  let b = this.x.add(this.y).square();
  let c = this.x.square();
  let d = this.y.square();
  let e = A.mul(c);
  let f = e.add(d);
  let h = this.z.square();
  let j = f.sub(h.double());
  return new Point(b.sub(c).sub(d).mul(j), f.mul(e.sub(d)), f.mul(j));
};

Point.zero = function () {
  return new Point(new Field(0), new Field(1), new Field(0));
};

/*let dbl_base = BASE.add(BASE);
let a = dbl_base.add(BASE).double();
let b = BASE.add(dbl_base).double();
alert(a.equals(b));
alert(BASE.mul(new Field(6)).equals(a));*/
