const MODULUS = BigInt("52435875175126190479447740508185965837690552500527637822603658699938581184513");

function Field(val) {
  this.value = ((BigInt(val) % MODULUS) + MODULUS) % MODULUS;
}

Field.prototype.isZero = function() {
  return this.value == BigInt(0);
}

Field.prototype.equals = function(other) {
  return this.value == other.value;
}

Field.prototype.double = function() {
  return new Field(this.value + this.value);
}

Field.prototype.square = function() {
  return new Field(this.value * this.value);
}

Field.prototype.neg = function() {
  return new Field(MODULUS - this.value);
}

Field.prototype.add = function(other) {
  return new Field(this.value + other.value);
}

Field.prototype.sub = function(other) {
  return new Field(this.value - other.value);
}

Field.prototype.mul = function(other) {
  return new Field(this.value * other.value);
}

Field.prototype.toString = function() {
  return this.value.toString();
}

function Point(x, y, z) {
  this.x = x;
  this.y = y;
  if(typeof z == "undefined") {
    this.z = new Field(1);
  } else {
    this.z = z;
  }
}

const A = new Field(-1);
const BASE = new Point(new Field("28867639725710769449342053336011988556061781325688749245863888315629457631946"), new Field("18"));
const D = new Field("19257038036680949359750312669786877991949435402254120286184196891950884077233");
const ORDER = BigInt("6554484396890773809930967563523245729705921265872317281365359162392183254199");

Point.prototype.toString = function() {
  return ("(" + this.x.toString() + ", " + this.y.toString() + ", " + this.z.toString() + ")");
}

Point.prototype.isZero = function() {
  return this.z.isZero();
}

Point.prototype.equals = function(other) {
  return (
    (this.x * other.z == other.x * this.z) &&
    (this.y * other.z == other.y * this.z)
  );
}

Point.prototype.add = function(other) {
  if(this.isZero()) {
    return new Point(other.x, other.y, other.z);
  }
  if(other.isZero()) {
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
    a.mul(f).mul((this.x.add(this.y)).mul(other.x.add(other.y)).sub(c).sub(d)),
    a.mul(g).mul(d.sub(A.mul(c))),
    f.mul(g)
  );
}

Point.prototype.double = function(other) {
  if(this.isZero()) {
      return Point.zero();
  }
  let b = this.x.add(this.y).square();
  let c = this.x.square();
  let d = this.y.square();
  let e = A.mul(c);
  let f = e.add(d);
  let h = this.z.square();
  let j = f.sub(h.double());
  return new Point(
    b.sub(c).sub(d).mul(j),
    f.mul(e.sub(d)),
    f.mul(j)
  );
}

Point.zero = function() {
  return new Point(new Field(0), new Field(1), new Field(0));
}

let dbl_base = BASE.add(BASE);
let a = dbl_base.add(BASE);
let b = BASE.add(dbl_base);
alert(a.equals(b));
