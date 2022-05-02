const MODULUS = BigInt("52435875175126190479447740508185965837690552500527637822603658699938581184513");

function Field(val) {
  this.value = ((BigInt(val) % MODULUS) + MODULUS) % MODULUS;
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
