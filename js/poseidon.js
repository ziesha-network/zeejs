function s_box(f) {
  let f2 = f.mul(f);
  let f4 = f2.mul(f2);
  return f4.mul(f);
}

function product_mds(elems, mds) {
  var result = new Array(elems.length);
  for (var i = 0; i < elems.length; i++) {
    result[i] = new Field(0);
  }
  for (var j = 0; j < elems.length; j++) {
    for (var k = 0; k < elems.length; k++) {
      result[j] = result[j].add(mds[j][k].mul(elems[k]));
    }
  }
  for (var i = 0; i < elems.length; i++) {
    elems[i] = result[i];
  }
}

function add_constants(elems, consts, offset) {
  for (var i = 0; i < elems.length; i++) {
    elems[i] = elems[i].add(consts[offset + i]);
  }
}

function partial_round(elems, consts, mds, offset) {
  add_constants(elems, consts, offset);
  elems[0] = s_box(elems[0]);
  product_mds(elems, mds);
}

function full_round(elems, consts, mds, offset) {
  add_constants(elems, consts, offset);
  for (var i = 0; i < elems.length; i++) {
    elems[i] = s_box(elems[i]);
  }
  product_mds(elems, mds);
}

function poseidon(elems, rounds, mds, r_f, r_p) {
  elems.unshift(new Field(0));
  var offset = 0;
  for (var i = 0; i < r_f / 2; i++) {
    full_round(elems, rounds, mds, offset);
    offset += elems.length;
  }
  for (var i = 0; i < r_p; i++) {
    partial_round(elems, rounds, mds, offset);
    offset += elems.length;
  }
  for (var i = 0; i < r_f / 2; i++) {
    full_round(elems, rounds, mds, offset);
    offset += elems.length;
  }
  return elems[1];
}

function poseidon2(a, b) {
  return poseidon(
    [a, b],
    POSEIDON2_ROUNDS,
    POSEIDON2_MDS,
    POSEIDON2_R_F,
    POSEIDON2_R_P
  );
}

function poseidon5(a, b, c, d, e) {
  return poseidon(
    [a, b, c, d, e],
    POSEIDON5_ROUNDS,
    POSEIDON5_MDS,
    POSEIDON5_R_F,
    POSEIDON5_R_P
  );
}

function poseidon7(a, b, c, d, e, f, g) {
  return poseidon(
    [a, b, c, d, e, f, g],
    POSEIDON7_ROUNDS,
    POSEIDON7_MDS,
    POSEIDON7_R_F,
    POSEIDON7_R_P
  );
}
