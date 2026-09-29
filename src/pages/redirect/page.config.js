module.exports = {
  externalAssets: {
    development: {
      styles: [ { href: "http://127.0.0.1:4132/base.css" } ],
      scripts: [ { src: "http://127.0.0.1:4131/redirect.js", defer: true } ],
    },
    production: {
      styles: [ { href: "https://i.mazey.net/style/lib/base.css" } ],
      scripts: [ { src: "https://i.mazey.net/polestar/lib/redirect.js", defer: true } ],
    },
  },
};
