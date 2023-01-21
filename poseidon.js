function s_box(f) {
  let f2 = f.mul(f);
  let f4 = f2.mul(f2);
  return f4.mul(f);
}

function product_mds(elems, mds) {
  var result = new Array(elems.length);
  for(var i=0;i<elems.length;i++) {
    result[i] = new Field(0);
  }
  for(var j=0;j<elems.length;j++) {
    for(var k=0;k<elems.length;k++) {
      result[j] = result[j].add(mds[j][k].mul(elems[k]));
    }
  }
  for(var i=0;i<elems.length;i++) {
    elems[i] = result[i];
  }
}

function add_constants(elems, consts, offset) {
  for(var i=0;i<elems.length;i++) {
    elems[i] = elems[i].add(consts[offset+i]);
  }
}

function partial_round(elems, consts, mds, offset) {
  add_constants(elems, consts, offset);
  elems[0] = s_box(elems[0]);
  product_mds(elems, mds);
}

function full_round(elems, consts, mds, offset) {
  add_constants(elems, consts, offset);
  for(var i=0;i<elems.length;i++) {
    elems[i] = s_box(elems[i]);
  }
  product_mds(elems, mds);
}

function poseidon2(a, b) {
  var elems = [new Field(0), a, b];
  var offset = 0;
  for(var i=0;i<POSEIDON2_R_F/2;i++) {
    full_round(elems, POSEIDON2_ROUNDS, POSEIDON2_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON2_R_P;i++) {
    partial_round(elems, POSEIDON2_ROUNDS, POSEIDON2_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON2_R_F/2;i++) {
    full_round(elems, POSEIDON2_ROUNDS, POSEIDON2_MDS, offset);
    offset += elems.length;
  }
  return elems[1];
}

function poseidon5(a, b, c, d, e) {
  var elems = [new Field(0), a, b, c, d, e];
  var offset = 0;
  for(var i=0;i<POSEIDON5_R_F/2;i++) {
    full_round(elems, POSEIDON5_ROUNDS, POSEIDON5_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON5_R_P;i++) {
    partial_round(elems, POSEIDON5_ROUNDS, POSEIDON5_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON5_R_F/2;i++) {
    full_round(elems, POSEIDON5_ROUNDS, POSEIDON5_MDS, offset);
    offset += elems.length;
  }
  return elems[1];
}

function poseidon7(a, b, c, d, e, f, g) {
  var elems = [new Field(0), a, b, c, d, e, f, g];
  var offset = 0;
  for(var i=0;i<POSEIDON7_R_F/2;i++) {
    full_round(elems, POSEIDON7_ROUNDS, POSEIDON7_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON7_R_P;i++) {
    partial_round(elems, POSEIDON7_ROUNDS, POSEIDON7_MDS, offset);
    offset += elems.length;
  }
  for(var i=0;i<POSEIDON7_R_F/2;i++) {
    full_round(elems, POSEIDON7_ROUNDS, POSEIDON7_MDS, offset);
    offset += elems.length;
  }
  return elems[1];
}
