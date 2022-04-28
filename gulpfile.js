const { execSync } = require("child_process");
const gulp = require("gulp");

function rdkitCopy(cb) {
  return gulp
    .src("node_modules/@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.*")
    .pipe(gulp.dest("public/"));
}

function packageProject(cb) {
  execSync("pika-pack", { stdio: "inherit" });
  cb();
}

exports.rdkitCopy = rdkitCopy;
exports.packageProject = packageProject;
exports.buildPackage = gulp.series(rdkitCopy, packageProject);
