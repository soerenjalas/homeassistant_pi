import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { createMarkdownRenderer } from "../public/markdown.js";

test("Markdown renders formatting, tables, and code without executable HTML or remote images", () => {
  const dom = new JSDOM("");
  const render = createMarkdownRenderer(marked, DOMPurify(dom.window));
  const fragment = render('**Bold** and `code`\n\n- Item\n\n|Room|°C|\n|---|---|\n|Bed|20|\n\n```yaml\nlight: on\n```\n\n[Safe](https://example.com)\n\n<script>alert(1)</script><img src="https://tracker.test/x" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">Bad</a><iframe src="https://evil.test"></iframe>');
  assert.equal(fragment.querySelector("strong").textContent, "Bold");
  assert.equal(fragment.querySelectorAll("li").length, 1);
  assert.equal(fragment.querySelector("td").textContent, "Bed");
  assert.match(fragment.querySelector("pre code").textContent, /light: on/);
  assert.equal(fragment.querySelector("script,img,iframe,[onclick],[onerror]"), null);
  const links = fragment.querySelectorAll("a");
  assert.equal(links[0].getAttribute("href"), "https://example.com");
  assert.equal(links[0].getAttribute("rel"), "noopener noreferrer");
  assert.equal(links[1].hasAttribute("href"), false);
  dom.window.close();
});
