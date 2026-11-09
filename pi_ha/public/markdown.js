export function createMarkdownRenderer(marked, purifier) {
  return (text) => {
    const fragment = purifier.sanitize(marked.parse(text, { gfm: true, breaks: true }), {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ["p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "del", "ul", "ol", "li", "blockquote", "pre", "code", "a", "table", "thead", "tbody", "tr", "th", "td"],
      ALLOWED_ATTR: ["href", "title", "start", "align"],
      ALLOW_DATA_ATTR: false,
    });
    for (const link of fragment.querySelectorAll("a")) {
      const href = link.getAttribute("href");
      if (href && !/^(?:https?:|mailto:|\/|#|\.\.?\/)/i.test(href)) link.removeAttribute("href");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
    return fragment;
  };
}
