module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": ["eslint:recommended", "airbnb"],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "indent": ["error", 4],
        "no-underscore-dangle": "off",
        "no-plusplus": "off",
        "no-bitwise": "off",
        "comma-dangle": "off",
        "function-paren-newline": "off",
        "no-continue": "off",
        "operator-linebreak": "off",
        "class-methods-use-this": "off",
        "max-len": "warn",
        "prefer-template": "warn",
        "import/prefer-default-export": "warn",
        "no-param-reassign": "warn",
    }
}
