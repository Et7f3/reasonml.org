/*
 * This script is used for generating the search index of the Belt API
 * Ideally we would like following information:
 *
 * - Module names (h1)
 *   - function names (```re sig)
 */
const unified = require("unified");
const markdown = require("remark-parse");
const stringify = require("remark-stringify");
const glob = require("glob");
const path = require("path");
const fs = require("fs");

const headers = options => (tree, file) => {
  const headers = [];
  let mainHeader;
  tree.children.forEach(child => {
    if (child.type === "heading" && child.depth === 1) {
      if (child.children.length > 0) {
        mainHeader = child.children[0].value;
      }
    }
    if (child.type === "heading" && child.depth === 2) {
      if (child.children.length > 0) {
        headers.push(child.children[0].value);
      }
    }
  });

  file.data = Object.assign({}, file.data, { headers, mainHeader });
};

const codeblocks = options => (tree, file) => {
  const { children } = tree;
  const codeblocks = {};

  const formatter = value => {
    // Strip newlines and weird spacing
    return value
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")");
  };

  children.forEach(child => {
    if (child.type === "code" && child.value) {
      const { meta, lang } = child;
      if (meta === "sig" && lang === "re") {
        if (codeblocks[lang] == null) {
          codeblocks[lang] = [];
        }
        codeblocks[lang].push(formatter(child.value));
      }
    }
  });

  file.data = Object.assign({}, file.data, { codeblocks });
};

const processor = unified()
  .use(markdown, { gfm: true })
  .use(stringify)
  .use(headers)
  .use(codeblocks);

const toBeltDocsPath = filepath => {
  return path.join("belt_docs", path.basename(filepath));
};

const BELT_MD_DIR = path.join(__dirname, "../pages/belt_docs");
const INDEX_FILE = path.join(__dirname, "../index_data/belt_api_index.json");
const SEARCH_INDEX_FILE = path.join(
  __dirname,
  "../index_data/belt_search_index.json"
);
const files = glob.sync(`${BELT_MD_DIR}/*.md?(x)`);

const processFile = filepath => {
  const content = fs.readFileSync(filepath, "utf8");
  const result = processor.processSync(content);

  const filename = path.parse(filepath).name;

  const dataset = {
    headers: result.data.headers,
    signatures: result.data.codeblocks.re,
    href: path.join("belt_docs", filename),
    moduleName: result.data.mainHeader
  };
  return dataset;
};

const result = files.map(processFile);

// Currently we reorder the data to a map, the key is
// reflected as the router pathname, as defined by the
// NextJS router
const index = result.reduce((acc, data) => {
  const { signatures = [], moduleName, headers } = data;
  acc["/" + data.href] = {
    signatures,
    moduleName,
    headers
  };

  return acc;
}, {});

const searchIndex = result.map(data => {
  const { moduleName, headers } = data;

  const content = headers.map(header => {
    return {
      reason: header,
      signature: "",
      js: []
    };
  });

  return {
    moduleName,
    href: "/" + data.href,
    content
  };
});

fs.writeFileSync(INDEX_FILE, JSON.stringify(index), "utf8");
fs.writeFileSync(SEARCH_INDEX_FILE, JSON.stringify(searchIndex), "utf8");
