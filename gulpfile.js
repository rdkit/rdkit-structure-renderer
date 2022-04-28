const { src, dest } = require("gulp");

function rdkitCopy(cb) {
  return src(
    "node_modules/@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.*"
  ).pipe(dest("public/"));
}

exports.rdkitCopy = rdkitCopy;
