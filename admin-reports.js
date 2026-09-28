// admin-reports.js
// ----------------------------------------------------------------------------
// Generates a Word (.docx) or PowerPoint (.pptx) activity report entirely in
// the browser — no server involved. The libraries that do the actual file
// building (docx.js, PptxGenJS) are loaded from a CDN ONLY when an admin
// clicks one of the two generate buttons, so regular members never pay the
// cost of downloading them. Both need an internet connection to load, same
// as everything else in this app that talks to Supabase.
//
// Input shape expected (built by computeAdminOverview() in app.js):
//   overview = {
//     rows: [{ name, university, city, phone, totalSteps,
//              lastActiveDays (number|null), lastCalledDays (number|null) }],
//     totalMembers, neverCalledCount, totalStepsAllTime
//   }
//   meta = { generatedOn: "displayable Ethiopian date string", lang: "am"|"en" }
// ----------------------------------------------------------------------------

var AdminReports = (function () {
  "use strict";

  function loadScriptOnce(src, isLoaded) {
    return new Promise(function (resolve, reject) {
      if (isLoaded()) return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function fmtDays(n, lang) {
    if (n === null || n === undefined) return lang === "am" ? "በጭራሽ" : "never";
    if (n === 0) return lang === "am" ? "ዛሬ" : "today";
    return lang === "am" ? (n + " ቀናት በፊት") : (n + " days ago");
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ================= DOCX ================= */

  // Builds a minimal but genuinely valid .docx by hand -- a .docx is just a
  // zip of a few XML parts, so this writes those parts directly instead of
  // depending on a full document-building library (an earlier version used
  // docx.js from a CDN and its browser bundle was not reliable in practice).
  function escXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  async function generateDocx(overview, meta) {
    await loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js",
      function () { return typeof window.JSZip !== "undefined"; }
    );
    var L = meta.lang === "am";
    var GREEN = "1F3D2B", GOLD = "A6791F", LINE = "E4D5AE";
    var FONT_TAG = '<w:rFonts w:ascii="Noto Sans Ethiopic" w:hAnsi="Noto Sans Ethiopic" w:cs="Noto Sans Ethiopic"/>';

    function run(text, opts) {
      opts = opts || {};
      var rpr = "<w:rPr>" + FONT_TAG
        + (opts.bold ? "<w:b/>" : "")
        + (opts.italic ? "<w:i/>" : "")
        + (opts.color ? '<w:color w:val="' + opts.color + '"/>' : "")
        + '<w:sz w:val="' + (opts.size || 20) + '"/><w:szCs w:val="' + (opts.size || 20) + '"/>'
        + "</w:rPr>";
      return "<w:r>" + rpr + '<w:t xml:space="preserve">' + escXml(text) + "</w:t></w:r>";
    }
    function para(text, opts) {
      opts = opts || {};
      var ppr = "<w:pPr>"
        + (opts.align ? '<w:jc w:val="' + opts.align + '"/>' : "")
        + (opts.spacingAfter !== undefined ? '<w:spacing w:after="' + opts.spacingAfter + '"/>' : "")
        + (opts.heading ? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="' + GOLD + '"/></w:pBdr>' : "")
        + "</w:pPr>";
      return "<w:p>" + ppr + run(text, opts) + "</w:p>";
    }
    function cell(text, opts) {
      opts = opts || {};
      var tcpr = '<w:tcPr><w:tcW w:w="' + (opts.width || 2000) + '" w:type="dxa"/>'
        + (opts.shade ? '<w:shd w:val="clear" w:fill="' + opts.shade + '"/>' : "")
        + "</w:tcPr>";
      return "<w:tc>" + tcpr + para(String(text), { bold: opts.bold, color: opts.color, size: opts.size || 18 }) + "</w:tc>";
    }
    function row(cells) { return "<w:tr>" + cells.join("") + "</w:tr>"; }
    function table(rows) {
      var borders = "<w:tblBorders>" + ["top","left","bottom","right","insideH","insideV"].map(function(s){
        return '<w:' + s + ' w:val="single" w:sz="4" w:color="' + LINE + '"/>';
      }).join("") + "</w:tblBorders>";
      return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' + borders + "</w:tblPr>" + rows.join("") + "</w:tbl>";
    }

    var COLW = { name: 2200, uni: 2000, steps: 1200, active: 1600, called: 1600, phone: 1400 };
    function headerRow() {
      return row([
        cell(L ? "ስም" : "Name", { width: COLW.name, shade: GREEN, color: "FFFFFF", bold: true }),
        cell(L ? "ዩኒቨርሲቲ" : "University", { width: COLW.uni, shade: GREEN, color: "FFFFFF", bold: true }),
        cell(L ? "እርምጃዎች" : "Steps", { width: COLW.steps, shade: GREEN, color: "FFFFFF", bold: true }),
        cell(L ? "መጨረሻ ንቁ" : "Last active", { width: COLW.active, shade: GREEN, color: "FFFFFF", bold: true }),
        cell(L ? "መጨረሻ ጥሪ" : "Last called", { width: COLW.called, shade: GREEN, color: "FFFFFF", bold: true }),
        cell(L ? "ስልክ" : "Phone", { width: COLW.phone, shade: GREEN, color: "FFFFFF", bold: true })
      ]);
    }
    function dataRow(r, i) {
      var shade = i % 2 === 1 ? "FBF6E9" : undefined;
      return row([
        cell(r.name, { width: COLW.name, shade: shade }),
        cell(r.university || "—", { width: COLW.uni, shade: shade }),
        cell(r.totalSteps, { width: COLW.steps, shade: shade }),
        cell(fmtDays(r.lastActiveDays, meta.lang), { width: COLW.active, shade: shade }),
        cell(fmtDays(r.lastCalledDays, meta.lang), { width: COLW.called, shade: shade }),
        cell(r.phone || "—", { width: COLW.phone, shade: shade })
      ]);
    }
    function buildTable(rows) {
      return table([headerRow()].concat(rows.map(dataRow)));
    }

    var attention = overview.rows.filter(function (r) {
      return r.lastCalledDays === null || r.lastCalledDays >= overview.overdueDays;
    });

    var body = "";
    body += para(L ? "ግቢ ጉባኤ ትስስር" : "Campus Connect", { align: "center", color: GREEN, size: 22, spacingAfter: 40 });
    body += para(L ? "የተማሪዎች እንቅስቃሴ ሪፖርት" : "Student Activity Report", { align: "center", bold: true, color: GOLD, size: 30, spacingAfter: 20 });
    body += para((L ? "ተዘጋጅቷል: " : "Generated: ") + meta.generatedOn, { align: "center", italic: true, color: "6B5D42", size: 20, spacingAfter: 300 });

    body += para(
      L ? ("ጠቅላላ አባላት: " + overview.totalMembers + "  ·  ፈጽሞ ያልተደወለላቸው: " + overview.neverCalledCount + "  ·  ጠቅላላ የጉዞ እርምጃዎች: " + overview.totalStepsAllTime)
        : ("Total members: " + overview.totalMembers + "  ·  Never called: " + overview.neverCalledCount + "  ·  Total journey steps: " + overview.totalStepsAllTime),
      { bold: true, size: 21, spacingAfter: 240 }
    );

    body += para(L ? "⚠ ትኩረት የሚፈልጉ አባላት" : "⚠ Members needing attention", { bold: true, color: GREEN, size: 26, spacingAfter: 100, heading: true });
    body += attention.length
      ? buildTable(attention)
      : para(L ? "ሁሉም በቅርብ ተደውሎላቸዋል።" : "Everyone has been reached recently.", { italic: true, size: 20 });

    body += para(L ? "ሙሉ የተማሪዎች ዝርዝር" : "Full member list", { bold: true, color: GREEN, size: 26, spacingAfter: 100, heading: true });
    body += buildTable(overview.rows);

    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + "<w:body>" + body
      + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
      + "</w:body></w:document>";

    var contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + "</Types>";

    var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + "</Relationships>";

    var zip = new window.JSZip();
    zip.file("[Content_Types].xml", contentTypesXml);
    zip.file("_rels/.rels", relsXml);
    zip.file("word/document.xml", documentXml);

    var blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    downloadBlob(blob, "campus-connect-activity-report.docx");
  }

  /* ================= PPTX ================= */

  async function generatePptx(overview, meta) {
    await loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/pptxgenjs@3/dist/pptxgen.bundle.js",
      function () { return typeof window.PptxGenJS !== "undefined"; }
    );
    var L = meta.lang === "am";
    var GREEN = "1F3D2B", GOLD = "A6791F", CREAM = "F8F3E7", WINE = "7A2331";
    var FONT = "Noto Sans Ethiopic";

    var pres = new window.PptxGenJS();
    pres.defineLayout({ name: "CC", width: 10, height: 5.63 });
    pres.layout = "CC";

    var attention = overview.rows.filter(function (r) {
      return r.lastCalledDays === null || r.lastCalledDays >= overview.overdueDays;
    });

    // Slide 1 — title
    var s1 = pres.addSlide();
    s1.background = { color: GREEN };
    s1.addText(L ? "ግቢ ጉባኤ ትስስር" : "Campus Connect", { x: 0.5, y: 1.6, w: 9, h: 0.5, color: "CDBE8F", fontFace: FONT, fontSize: 18, align: "center" });
    s1.addText(L ? "የተማሪዎች እንቅስቃሴ ሪፖርት" : "Student Activity Report", { x: 0.5, y: 2.1, w: 9, h: 0.9, color: "FBF4E2", fontFace: FONT, fontSize: 32, bold: true, align: "center" });
    s1.addText((L ? "ተዘጋጅቷል: " : "Generated: ") + meta.generatedOn, { x: 0.5, y: 3.1, w: 9, h: 0.4, color: "CDBE8F", fontFace: FONT, fontSize: 14, italic: true, align: "center" });

    // Slide 2 — overview numbers
    var s2 = pres.addSlide();
    s2.background = { color: CREAM };
    s2.addText(L ? "አጠቃላይ እይታ" : "Overview", { x: 0.4, y: 0.3, w: 9, h: 0.5, color: GREEN, fontFace: FONT, fontSize: 24, bold: true });
    var stats = [
      [String(overview.totalMembers), L ? "ጠቅላላ አባላት" : "Total members"],
      [String(overview.neverCalledCount), L ? "ፈጽሞ ያልተደወለላቸው" : "Never called"],
      [String(attention.length), L ? "ትኩረት የሚፈልጉ" : "Need attention"],
      [String(overview.totalStepsAllTime), L ? "ጠቅላላ እርምጃዎች" : "Total steps"]
    ];
    stats.forEach(function (st, i) {
      var x = 0.4 + (i % 2) * 4.7;
      var y = 1.1 + Math.floor(i / 2) * 1.9;
      s2.addShape("roundRect", { x: x, y: y, w: 4.4, h: 1.6, fill: { color: "FFFDF8" }, line: { color: "E4D5AE", width: 1 }, rectRadius: 0.05 });
      s2.addText(st[0], { x: x, y: y + 0.15, w: 4.4, h: 0.8, align: "center", color: GOLD, fontFace: FONT, fontSize: 36, bold: true });
      s2.addText(st[1], { x: x, y: y + 1.0, w: 4.4, h: 0.5, align: "center", color: "5B4E3A", fontFace: FONT, fontSize: 14 });
    });

    // Slide(s) — needs attention
    function addTableSlides(title, rows, cols) {
      var CHUNK = 10;
      for (var i = 0; i < Math.max(rows.length, 1); i += CHUNK) {
        var chunk = rows.slice(i, i + CHUNK);
        var sl = pres.addSlide();
        sl.background = { color: CREAM };
        sl.addText(title + (rows.length > CHUNK ? " (" + (Math.floor(i / CHUNK) + 1) + ")" : ""),
          { x: 0.4, y: 0.25, w: 9, h: 0.5, color: GREEN, fontFace: FONT, fontSize: 22, bold: true });
        var tableRows = [cols.map(function (c) { return { text: c.header, options: { bold: true, color: "FFFFFF", fill: { color: GREEN }, fontFace: FONT, fontSize: 11 } }; })];
        if (chunk.length === 0) {
          tableRows.push([{ text: L ? "ምንም የለም" : "None", options: { colspan: cols.length, align: "center", fontFace: FONT, fontSize: 12 } }]);
        } else {
          chunk.forEach(function (r, ri) {
            var fill = ri % 2 === 1 ? "FBF6E9" : "FFFFFF";
            tableRows.push(cols.map(function (c) {
              return { text: String(c.value(r)), options: { fill: { color: fill }, fontFace: FONT, fontSize: 11 } };
            }));
          });
        }
        sl.addTable(tableRows, { x: 0.4, y: 0.9, w: 9.2, colW: cols.map(function (c) { return c.width; }), border: { type: "solid", color: "E4D5AE", pt: 0.5 } });
      }
    }

    addTableSlides(
      L ? "⚠ ትኩረት የሚፈልጉ አባላት" : "⚠ Members needing attention",
      attention,
      [
        { header: L ? "ስም" : "Name", width: 2.2, value: function (r) { return r.name; } },
        { header: L ? "ዩኒቨርሲቲ" : "University", width: 2.3, value: function (r) { return r.university || "—"; } },
        { header: L ? "መጨረሻ ጥሪ" : "Last called", width: 2.2, value: function (r) { return fmtDays(r.lastCalledDays, meta.lang); } },
        { header: L ? "ስልክ" : "Phone", width: 2.5, value: function (r) { return r.phone || "—"; } }
      ]
    );

    addTableSlides(
      L ? "ሙሉ የተማሪዎች ዝርዝር" : "Full member list",
      overview.rows,
      [
        { header: L ? "ስም" : "Name", width: 2.3, value: function (r) { return r.name; } },
        { header: L ? "ዩኒቨርሲቲ" : "University", width: 2.3, value: function (r) { return r.university || "—"; } },
        { header: L ? "እርምጃዎች" : "Steps", width: 1.4, value: function (r) { return r.totalSteps; } },
        { header: L ? "መጨረሻ ንቁ" : "Last active", width: 1.6, value: function (r) { return fmtDays(r.lastActiveDays, meta.lang); } },
        { header: L ? "መጨረሻ ጥሪ" : "Last called", width: 1.6, value: function (r) { return fmtDays(r.lastCalledDays, meta.lang); } }
      ]
    );

    await pres.writeFile({ fileName: "campus-connect-activity-report.pptx" });
  }

  return { generateDocx: generateDocx, generatePptx: generatePptx };
})();

window.AdminReports = AdminReports;
