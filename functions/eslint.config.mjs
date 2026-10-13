// Configuración de ESLint 9 (flat config) para Cloud Functions.
//
// Migrada desde .eslintrc.js (ESLint 8) conservando la misma política:
// eslint:recommended + eslint-plugin-import + estilo Google +
// typescript-eslint recommended, con los mismos overrides del proyecto.
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import tseslint from "typescript-eslint";

// Reglas de eslint-config-google 0.14.0 (paquete sin mantenimiento desde
// 2019, incompatible con ESLint 9). Copiadas tal cual salvo dos que ESLint 9
// eliminó: valid-jsdoc (ya estaba desactivada) y require-jsdoc, que pasa a
// jsdoc/require-jsdoc con las mismas opciones.
const googleStyle = {
  "no-cond-assign": "off",
  "no-irregular-whitespace": "error",
  "no-unexpected-multiline": "error",
  "curly": ["error", "multi-line"],
  "guard-for-in": "error",
  "no-caller": "error",
  "no-extend-native": "error",
  "no-extra-bind": "error",
  "no-invalid-this": "error",
  "no-multi-spaces": "error",
  "no-multi-str": "error",
  "no-new-wrappers": "error",
  "no-throw-literal": "error",
  "no-with": "error",
  "prefer-promise-reject-errors": "error",
  "no-unused-vars": ["error", {args: "none"}],
  "array-bracket-newline": "off",
  "array-bracket-spacing": ["error", "never"],
  "array-element-newline": "off",
  "block-spacing": ["error", "never"],
  "brace-style": "error",
  "camelcase": ["error", {properties: "never"}],
  "comma-dangle": ["error", "always-multiline"],
  "comma-spacing": "error",
  "comma-style": "error",
  "computed-property-spacing": "error",
  "eol-last": "error",
  "func-call-spacing": "error",
  "key-spacing": "error",
  "keyword-spacing": "error",
  "linebreak-style": "error",
  "new-cap": "error",
  "no-array-constructor": "error",
  "no-mixed-spaces-and-tabs": "error",
  "no-multiple-empty-lines": ["error", {max: 2}],
  "no-new-object": "error",
  "no-tabs": "error",
  "no-trailing-spaces": "error",
  "object-curly-spacing": "error",
  "one-var": ["error", {var: "never", let: "never", const: "never"}],
  "operator-linebreak": ["error", "after"],
  "padded-blocks": ["error", "never"],
  "quote-props": ["error", "consistent"],
  "semi": "error",
  "semi-spacing": "error",
  "space-before-blocks": "error",
  "space-before-function-paren": ["error", {
    asyncArrow: "always",
    anonymous: "never",
    named: "never",
  }],
  "spaced-comment": ["error", "always"],
  "switch-colon-spacing": "error",
  "arrow-parens": ["error", "always"],
  "constructor-super": "error",
  "generator-star-spacing": ["error", "after"],
  "no-new-symbol": "error",
  "no-this-before-super": "error",
  "no-var": "error",
  "prefer-const": ["error", {destructuring: "all"}],
  "prefer-rest-params": "error",
  "prefer-spread": "error",
  "rest-spread-spacing": "error",
  "yield-star-spacing": ["error", "after"],
  "jsdoc/require-jsdoc": ["error", {
    require: {
      FunctionDeclaration: true,
      MethodDefinition: true,
      ClassDeclaration: true,
    },
  }],
};

export default tseslint.config(
  // scripts/ (mantenimiento de datos, .mjs) nunca entró en el lint: ESLint 8
  // corría con --ext .js,.ts. Se mantiene fuera para conservar el alcance.
  {ignores: ["lib/**", "generated/**", "scripts/**"]},
  js.configs.recommended,
  importPlugin.flatConfigs.errors,
  importPlugin.flatConfigs.warnings,
  importPlugin.flatConfigs.typescript,
  {
    plugins: {jsdoc},
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: googleStyle,
  },
  tseslint.configs.recommended,
  {
    rules: {
      "quotes": ["error", "double"],
      // Con ESLint 8 el parser quedaba en ES6 (env es6) y comma-dangle no
      // aplicaba a funciones; con ecmaVersion "latest" sí. Se fija explícito
      // para conservar el comportamiento (y el código) de siempre.
      "comma-dangle": ["error", {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "always-multiline",
        exports: "always-multiline",
        functions: "ignore",
      }],
      "import/no-unresolved": "off",
      "indent": ["error", 2],
      // 80 de eslint-config-google es demasiado estricto para TS con tipos largos.
      "max-len": ["error", {code: 100}],
    },
  },
);
