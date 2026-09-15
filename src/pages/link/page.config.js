module.exports = {
  externalAssets: {
    development: {
      styles: [
        {
          href: "http://127.0.0.1:4132/link.css",
        },
      ],
      scripts: [
        {
          src: "http://127.0.0.1:4131/link.js",
          defer: true,
        },
      ],
    },
    production: {
      styles: [
        {
          href: "https://i.mazey.net/style/lib/link.css",
        },
      ],
      scripts: [
        {
          src: "https://i.mazey.net/polestar/lib/link.js",
          defer: true,
        },
      ],
    },
  },
};
