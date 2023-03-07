const { Renderer } = require('../dist/rdkit-structure-renderer-node.js');
const path = require('path');

const defaultDrawOpts = {
    bondLineWidth: 0.7,
    multipleBondOffset: 0.25,
    baseFontSize: 1.0,
    minFontSize: -1,
    maxFontSize: -1,
    annotationFontScale: 0.7,
    highlightBondWidthMultiplier: 20,
    dummyIsotopeLabels: false,
    atomColourPalette: {
        0: [0.1, 0.1, 0.1],
        1: [0.0, 0.0, 0.0],
        6: [0.0, 0.0, 0.0],
        7: [0.0, 0.0, 1.0],
        8: [1.0, 0.0, 0.0],
        9: [0.0, 0.498, 0.0],
        15: [0.498, 0.0, 0.498],
        16: [0.498, 0.247, 0.0],
        17: [0.0, 0.498, 0.0],
        35: [0.0, 0.498, 0.0],
        53: [0.247, 0.0, 0.498],
    },
    backgroundColour: [1, 1, 1, 1],
};

const molText = 'C1CC1N2C=C(C(=O)C3=CC(=C(C=C32)N4CCNCC4)F)C(=O)O';
const scaffoldText = `
     RDKit          2D

 11 12  0  0  0  0  0  0  0  0999 V2000
    1.2722   -0.6309    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
    1.7728    0.2348    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2735    1.1012    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2736    1.1020    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.2257    1.9684    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
   -0.2271    0.2364    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2271    0.2372    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.7277   -0.6285    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2284   -1.4949    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.2284   -1.4957    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2722   -0.6300    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0
  2  3  2  0
  3  4  1  0
  4  5  2  0
  4  6  1  0
  6  7  2  0
  7  8  1  0
  8  9  2  0
  9 10  1  0
 10 11  2  0
 11  1  1  0
 11  6  1  0
M  END`;

const minimalLibPath = path.resolve(__dirname, '..', 'public');
Renderer.getDefaultDrawOpts = () => defaultDrawOpts;
(async () => {
    await Renderer.init(minimalLibPath/*, null, initRDKitModule*/);
    console.log(await Renderer.getImageFromMolText(molText, scaffoldText, {
        width: 400,
        height: 300,
        format: 'svg',
        userOpts: {
            SCAFFOLD_HIGHLIGHT: true,
        },
    }));
})();
