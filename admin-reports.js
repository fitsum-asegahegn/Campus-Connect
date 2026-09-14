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

  async function generateDocx(overview, meta) {
    await loadScriptOnce(
      "https://unpkg.com/docx@8/build/index.js",
      function () { return typeof window.docx !== "undefined"; }
    );
    var d = window.docx;
    var L = meta.lang === "am";
    var FONT = "Noto Sans Ethiopic";
    var GREEN = "1F3D2B", GOLD = "A6791F", LINE = "E4D5AE";

    function run(text, opts) { return new d.TextRun(Object.assign({ text: String(text), font: FONT }, opts || {})); }
    function p(text, opts) { return new d.Paragraph(Object.assign({ children: [run(text, opts && opts.run)] }, opts && opts.para)); }
    function cell(text, opts) {
      opts = opts || {};
      return new d.TableCell({
        width: { size: opts.width, type: d.WidthType.DXA },
        shading: opts.shade ? { type: d.ShadingType.CLEAR, fill: opts.shade } : undefined,
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new d.Paragraph({ children: [run(text, { bold: !!opts.bold, color: opts.color, size: opts.size || 18 })] })]
      });
    }

    var COLW = { name: 2200, uni: 2000, steps: 1200, active: 1600, called: 1600, phone: 1400 };
    function headerRow() {
      return new d.TableRow({
        tableHeader: true, cantSplit: true,
        children: [
          cell(L ? "ስም" : "Name", { width: COLW.name, shade: GREEN, color: "FFFFFF", bold: true }),
          cell(L ? "ዩኒቨርሲቲ" : "University", { width: COLW.uni, shade: GREEN, color: "FFFFFF", bold: true }),
          cell(L ? "እርምጃዎች" : "Steps", { width: COLW.steps, shade: GREEN, color: "FFFFFF", bold: true }),
          cell(L ? "መጨረሻ ንቁ" : "Last active", { width: COLW.active, shade: GREEN, color: "FFFFFF", bold: true }),
          cell(L ? "መጨረሻ ጥሪ" : "Last called", { width: COLW.called, shade: GREEN, color: "FFFFFF", bold: true }),
          cell(L ? "ስልክ" : "Phone", { width: COLW.phone, shade: GREEN, color: "FFFFFF", bold: true })
        ]
      });
    }
    function dataRow(r, i) {
      var shade = i % 2 === 1 ? "FBF6E9" : undefined;
      return new d.TableRow({
        cantSplit: true,
        children: [
          cell(r.name, { width: COLW.name, shade: shade }),
          cell(r.university || "—", { width: COLW.uni, shade: shade }),
          cell(r.totalSteps, { width: COLW.steps, shade: shade }),
          cell(fmtDays(r.lastActiveDays, meta.lang), { width: COLW.active, shade: shade }),
          cell(fmtDays(r.lastCalledDays, meta.lang), { width: COLW.called, shade: shade }),
          cell(r.phone || "—", { width: COLW.phone, shade: shade })
        ]
      });
    }
    function buildTable(rows) {
      var total = COLW.name + COLW.uni + COLW.steps + COLW.active + COLW.called + COLW.phone;
      return new d.Table({
        width: { size: total, type: d.WidthType.DXA },
        columnWidths: [COLW.name, COLW.uni, COLW.steps, COLW.active, COLW.called, COLW.phone],
        borders: {
          top: { style: d.BorderStyle.SINGLE, size: 4, color: LINE },
          bottom: { style: d.BorderStyle.SINGLE, size: 4, color: LINE },
          left: { style: d.BorderStyle.SINGLE, size: 4, color: LINE },
          right: { style: d.BorderStyle.SINGLE, size: 4, color: LINE },
          insideHorizontal: { style: d.BorderStyle.SINGLE, size: 4, color: LINE },
          insideVertical: { style: d.BorderStyle.SINGLE, size: 4, color: LINE }
        },
        rows: [headerRow()].concat(rows.map(dataRow))
      });
    }

    var attention = overview.rows.filter(function (r) {
      return r.lastCalledDays === null || r.lastCalledDays >= overview.overdueDays;
    });

    var children = [];
    children.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [run(L ? "ግቢ ጉባኤ ትስስር" : "Campus Connect", { size: 22, color: GREEN })]
    }));
    children.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [run(L ? "የተማሪዎች እንቅስቃሴ ሪፖርት" : "Student Activity Report", { size: 30, bold: true, color: GOLD })]
    }));
    children.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [run((L ? "ተዘጋጅቷል: " : "Generated: ") + meta.generatedOn, { italics: true, size: 20, color: "6B5D42" })]
    }));

    children.push(p(L
      ? "ጠቅላላ አባላት: " + overview.totalMembers + "  ·  ፈጽሞ ያልተደወለላቸው: " + overview.neverCalledCount + "  ·  ጠቅላላ የጉዞ እርምጃዎች: " + overview.totalStepsAllTime
      : "Total members: " + overview.totalMembers + "  ·  Never called: " + overview.neverCalledCount + "  ·  Total journey steps: " + overview.totalStepsAllTime,
      { run: { size: 21, bold: true }, para: { spacing: { after: 240 } } }
    ));

    children.push(new d.Paragraph({
      heading: d.HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      border: { bottom: { color: GOLD, space: 4, style: d.BorderStyle.SINGLE, size: 8 } },
      children: [run(L ? "⚠ ትኩረት የሚፈልጉ አባላት" : "⚠ Members needing attention", { bold: true, size: 26, color: GREEN })]
    }));
    children.push(attention.length
      ? buildTable(attention)
      : p(L ? "ሁሉም በቅርብ ተደውሎላቸዋል።" : "Everyone has been reached recently.", { run: { italics: true, size: 20 } })
    );

    children.push(new d.Paragraph({
      heading: d.HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 100 },
      border: { bottom: { color: GOLD, space: 4, style: d.BorderStyle.SINGLE, size: 8 } },
      children: [run(L ? "ሙሉ የተማሪዎች ዝርዝር" : "Full member list", { bold: true, size: 26, color: GREEN })]
    }));
    children.push(buildTable(overview.rows));

    var doc = new d.Document({
      sections: [{
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children: children
      }]
    });

    var blob = await d.Packer.toBlob(doc);
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
