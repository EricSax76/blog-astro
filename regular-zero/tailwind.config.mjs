import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        cream: "#f3f0e6",
        "deep-green": "#2c5530",
        sage: "#8fa382",
        earth: "#a08060",
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "serif"],
        sans: ['"Red Hat Text"', "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: "rgba(47, 61, 70, 0.82)",
            lineHeight: "1.85",
            "--tw-prose-body": "rgba(47, 61, 70, 0.82)",
            "--tw-prose-headings": theme("colors.deep-green"),
            "--tw-prose-lead": "rgba(47, 61, 70, 0.75)",
            "--tw-prose-links": theme("colors.sage"),
            "--tw-prose-bold": theme("colors.deep-green"),
            "--tw-prose-counters": theme("colors.sage"),
            "--tw-prose-bullets": theme("colors.sage"),
            "--tw-prose-hr": "rgba(107, 144, 128, 0.25)",
            "--tw-prose-quotes": theme("colors.deep-green"),
            "--tw-prose-quote-borders": "rgba(107, 144, 128, 0.45)",
            "--tw-prose-captions": "rgba(47, 61, 70, 0.6)",
            "--tw-prose-code": theme("colors.deep-green"),
            "--tw-prose-pre-code": theme("colors.cream"),
            "--tw-prose-pre-bg": "rgba(47, 61, 70, 0.95)",
            fontFamily: theme("fontFamily.sans").join(", "),
            p: {
              marginTop: "0.85em",
              marginBottom: "0.85em",
            },
            h1: {
              fontFamily: theme("fontFamily.serif").join(", "),
              letterSpacing: "-0.01em",
              marginTop: "0",
              marginBottom: "0.6em",
            },
            h2: {
              fontFamily: theme("fontFamily.serif").join(", "),
              letterSpacing: "-0.01em",
              marginTop: "1.6em",
              marginBottom: "0.6em",
            },
            h3: {
              fontFamily: theme("fontFamily.serif").join(", "),
              letterSpacing: "-0.01em",
              marginTop: "1.4em",
              marginBottom: "0.5em",
            },
            h4: {
              fontFamily: theme("fontFamily.serif").join(", "),
              letterSpacing: "-0.01em",
              marginTop: "1.2em",
              marginBottom: "0.5em",
            },
            ul: {
              marginTop: "0.9em",
              marginBottom: "0.9em",
            },
            ol: {
              marginTop: "0.9em",
              marginBottom: "0.9em",
            },
            li: {
              marginTop: "0.25em",
              marginBottom: "0.25em",
            },
            a: {
              textDecoration: "none",
              fontWeight: "600",
              borderBottom: "1px solid rgba(107, 144, 128, 0.45)",
            },
            "a:hover": {
              color: theme("colors.deep-green"),
              borderBottomColor: theme("colors.deep-green"),
            },
            strong: {
              color: theme("colors.deep-green"),
              fontWeight: "700",
            },
            blockquote: {
              fontStyle: "italic",
              color: "rgba(47, 61, 70, 0.8)",
              borderLeftColor: theme("colors.sage"),
            },
            "blockquote p:first-of-type::before": { content: "none" },
            "blockquote p:last-of-type::after": { content: "none" },
            code: {
              backgroundColor: "rgba(107, 144, 128, 0.12)",
              borderRadius: "0.35rem",
              padding: "0.15em 0.35em",
              fontWeight: "600",
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            pre: {
              borderRadius: "1rem",
              border: "1px solid rgba(107, 144, 128, 0.25)",
            },
            hr: {
              marginTop: "2em",
              marginBottom: "2em",
            },
          },
        },
        lg: {
          css: {
            fontSize: "1.125rem",
            lineHeight: "1.9",
          },
        },
        cream: {
          css: {
            color: "rgba(224, 221, 207, 0.86)",
            "--tw-prose-body": "rgba(224, 221, 207, 0.86)",
            "--tw-prose-headings": "rgba(255, 255, 255, 0.95)",
            "--tw-prose-lead": "rgba(224, 221, 207, 0.8)",
            "--tw-prose-links": theme("colors.sage"),
            "--tw-prose-bold": "rgba(255, 255, 255, 0.95)",
            "--tw-prose-counters": theme("colors.sage"),
            "--tw-prose-bullets": theme("colors.sage"),
            "--tw-prose-hr": "rgba(224, 221, 207, 0.2)",
            "--tw-prose-quotes": "rgba(255, 255, 255, 0.9)",
            "--tw-prose-quote-borders": "rgba(107, 144, 128, 0.6)",
            "--tw-prose-captions": "rgba(224, 221, 207, 0.7)",
            "--tw-prose-code": "rgba(255, 255, 255, 0.9)",
            "--tw-prose-pre-code": theme("colors.cream"),
            "--tw-prose-pre-bg": "rgba(15, 26, 23, 0.95)",
            a: {
              color: theme("colors.sage"),
              borderBottom: "1px solid rgba(224, 221, 207, 0.35)",
            },
            "a:hover": {
              color: theme("colors.cream"),
              borderBottomColor: theme("colors.cream"),
            },
            blockquote: {
              color: "rgba(255, 255, 255, 0.85)",
              borderLeftColor: theme("colors.sage"),
            },
            code: {
              backgroundColor: "rgba(224, 221, 207, 0.12)",
            },
            pre: {
              border: "1px solid rgba(224, 221, 207, 0.16)",
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
