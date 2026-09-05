(function(){
  "use strict";

  /* ================= i18n ================= */
  var LANG = "am";
  function t(am, en){ return LANG === "am" ? am : en; }
  // Gender-aware Amharic text: once the person has picked ወንድም/እህት in their
  // profile, we use the correct single form (አንተ vs አንቺ, ...ህ vs ...ሽ) instead
  // of writing both. Before gender is known, `neutral` (polite/plural form) is used.
  function gt(maleAm, femaleAm, neutral){
    var gnd = state.profile && state.profile.gender;
    if (gnd === "m") return maleAm;
    if (gnd === "f") return femaleAm;
    return neutral !== undefined ? neutral : maleAm;
  }
  // Combines language + gender: tg(maleAm, femaleAm, neutralAm, en)
  function tg(maleAm, femaleAm, neutralAm, en){
    return LANG === "am" ? gt(maleAm, femaleAm, neutralAm) : en;
  }
  function applyStaticLang(){
    document.querySelectorAll("[data-am]").forEach(function(el){
      el.textContent = LANG === "am" ? el.getAttribute("data-am") : el.getAttribute("data-en");
    });
    document.getElementById("fw-lang-toggle").textContent = LANG === "am" ? "EN" : "አማ";
  }

  /* ================= misc helpers ================= */
  function toast(msg){
    var el = document.getElementById("fw-toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ el.classList.remove("show"); }, 2200);
  }
  function fmtDate(iso){
    try{
      var d = new Date(iso);
      return d.toLocaleDateString(LANG === "am" ? "en-GB" : "en-GB", { day:"numeric", month:"short" });
    }catch(e){ return iso; }
  }
  function escapeHtml(s){
    return (s||"").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  /* ================= Ethiopian calendar (ethiopicDate) ================= */
  // Self-contained Gregorian <-> Ethiopian calendar conversion, verified against
  // known reference dates (Ethiopian Millennium: 1 Meskerem 2000 = 12 Sept 2007;
  // 1 Meskerem 2016 = 12 Sept 2023).
  var ETH_MONTHS = [
    { am: "መስከረም", en: "Meskerem" }, { am: "ጥቅምት", en: "Tikimt" }, { am: "ኅዳር", en: "Hidar" },
    { am: "ታኅሳስ", en: "Tahsas" }, { am: "ጥር", en: "Tir" }, { am: "የካቲት", en: "Yekatit" },
    { am: "መጋቢት", en: "Megabit" }, { am: "ሚያዝያ", en: "Miazia" }, { am: "ግንቦት", en: "Ginbot" },
    { am: "ሰኔ", en: "Sene" }, { am: "ሐምሌ", en: "Hamle" }, { am: "ነሐሴ", en: "Nehase" }, { am: "ጳጉሜ", en: "Pagume" }
  ];
  function isGregLeap(y){ return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function isEthLeap(y){ return y % 4 === 3; }
  function ethMonthDayCount(ethYear, ethMonth){
    if (ethMonth !== 13) return 30;
    return (ethYear && isEthLeap(ethYear)) ? 6 : 5;
  }
  // Gregorian (UTC) date of Meskerem 1 for a given Ethiopian year.
  function ethNewYearGregDate(ethYear){
    var gregStartYear = ethYear + 7;
    var day = isGregLeap(gregStartYear + 1) ? 12 : 11;
    return new Date(Date.UTC(gregStartYear, 8, day)); // month 8 = September (0-indexed)
  }
  function ethiopianToGregorian(ethYear, ethMonth, ethDay){
    var newYear = ethNewYearGregDate(ethYear);
    var offsetDays = (ethMonth - 1) * 30 + (ethDay - 1);
    var g = new Date(newYear.getTime());
    g.setUTCDate(g.getUTCDate() + offsetDays);
    return g;
  }
  function gregorianToEthiopian(gregDate){
    var y = gregDate.getUTCFullYear();
    var nyThisGregYear = ethNewYearGregDate(y - 7);
    var ethYear, newYear;
    if (gregDate.getTime() >= nyThisGregYear.getTime()){
      ethYear = y - 7; newYear = nyThisGregYear;
    } else {
      ethYear = y - 8; newYear = ethNewYearGregDate(y - 8);
    }
    var diffDays = Math.round((gregDate.getTime() - newYear.getTime()) / 86400000);
    var ethMonth = Math.floor(diffDays / 30) + 1;
    var ethDay = (diffDays % 30) + 1;
    return { year: ethYear, month: ethMonth, day: ethDay };
  }
  function todayEthiopian(){
    var now = new Date();
    return gregorianToEthiopian(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }
  function ethMonthName(m){ return LANG === "am" ? ETH_MONTHS[m-1].am : ETH_MONTHS[m-1].en; }
  function fmtEthDate(b){
    if (!b || !b.month || !b.day) return "";
    return b.day + " " + ethMonthName(b.month) + (b.year ? " " + b.year : "");
  }

  /* ================= seed content (only if empty) ================= */
  var VERSES = [
    { am: "እግዚአብሔር ብርሃኔና መድኃኒቴ ነው፤ የማንንስ እፈራለሁ?", en: "The Lord is my light and my salvation — whom shall I fear?", ref: "መዝ 27:1 / Ps 27:1" },
    { am: "ሁሉን በእርሱ በሚያበረታኝ እችላለሁ።", en: "I can do all things through Him who strengthens me.", ref: "ፊል 4:13 / Phil 4:13" },
    { am: "እርስ በርሳችሁ ተዋደዱ፣ እኔ እንደ ወደድኋችሁ።", en: "Love one another, as I have loved you.", ref: "ዮሐ 13:34 / John 13:34" },
    { am: "በጌታ ሁልጊዜ ደስ ይበላችሁ፤ ደግሜ እላለሁ ደስ ይበላችሁ።", en: "Rejoice in the Lord always; again I will say, rejoice.", ref: "ፊል 4:4 / Phil 4:4" },
    { am: "ልጆቼ ኑ ስሙኝ እግዚአብሔርን መፍራት አስተምራችኋለሁ።", en: "Come, children, listen to me; I will teach you the fear of the Lord.", ref: "መዝ 34:11 / Ps 34:11" },
    { am: "ሸክማችሁን ሁሉ በእርሱ ላይ ጣሉ፤ እርሱ ስለ እናንተ ያስባልና።", en: "Cast all your anxiety on Him, because He cares for you.", ref: "1ጴጥ 5:7 / 1 Pet 5:7" },
    { am: "የልብን ደስታ እግዚአብሔር ይሰጣል፤ ተስፋችሁን በእርሱ አድርጉ።", en: "Trust in the Lord with all your heart.", ref: "ምሳ 3:5 / Prov 3:5" }
  ];
  function todaysVerse(){
    var day = Math.floor(Date.now() / 86400000);
    return VERSES[day % VERSES.length];
  }

  var READING_PLAN = [
    { am: "ማቴዎስ ምዕ. 5", en: "Matthew ch. 5" },
    { am: "መዝሙር 23", en: "Psalm 23" },
    { am: "ዮሐንስ ምዕ. 1", en: "John ch. 1" },
    { am: "ሮሜ ምዕ. 12", en: "Romans ch. 12" },
    { am: "መዝሙር 121", en: "Psalm 121" },
    { am: "1ቆሮንቶስ ምዕ. 13", en: "1 Corinthians ch. 13" },
    { am: "ፊልጵስዩስ ምዕ. 4", en: "Philippians ch. 4" }
  ];

  var WEEKLY_CHALLENGES = [
    { m: "ዛሬ አንድ ጓደኛህን ደውለህ 'እንዴት ነህ' በል።", f: "ዛሬ አንድ ጓደኛሽን ደውለሽ 'እንዴት ነሽ' በይ።", en: "Call one friend today and simply ask how they're doing." },
    { m: "ማቴዎስ 6:5-13ን አንብብ እና አንድ ሐሳብ ጻፍ።", f: "ማቴዎስ 6:5-13ን አንብቢ እና አንድ ሐሳብ ጻፊ።", en: "Read Matthew 6:5–13 and write down one thought." },
    { m: "ለራቀ የክፍል ጓደኛህ የማበረታቻ መልእክት ላክ።", f: "ለራቀ የክፍል ጓደኛሽ የማበረታቻ መልእክት ላኪ።", en: "Send an encouraging message to a classmate who's been distant." },
    { m: "ዛሬ ከመተኛትህ በፊት 5 ደቂቃ ጸልይ።", f: "ዛሬ ከመተኛትሽ በፊት 5 ደቂቃ ጸልዪ።", en: "Pray for 5 minutes before you sleep tonight." }
  ];
  function weekKey(){
    var d = new Date();
    var onejan = new Date(d.getFullYear(),0,1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
    return d.getFullYear() + "-W" + week;
  }
  function thisWeekChallenge(){
    var d = new Date();
    var onejan = new Date(d.getFullYear(),0,1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
    return WEEKLY_CHALLENGES[week % WEEKLY_CHALLENGES.length];
  }
  function challengeText(ch){
    return LANG === "am" ? gt(ch.m, ch.f, ch.m) : ch.en;
  }

  /* ================= state ================= */
  var state = {
    userId: null,
    tab: "feed",
    profile: null,
    feed: [],
    events: [], rsvps: [],
    prayers: [], prayed: [],
    readChecked: [],
    challengeDone: [],
    directory: []
  };

  /* ================= profile ================= */
  async function loadProfile(){
    state.profile = await DB.getMyProfile(state.userId);
  }
  function needsProfile(){ return !state.profile || !state.profile.name; }

  function buildEthDaySelect(selectedDay, selectedMonth){
    var max = (selectedMonth === 13) ? 6 : 30;
    var opts = '<option value="">' + t("ቀን", "Day") + '</option>';
    for (var d = 1; d <= max; d++){
      opts += '<option value="' + d + '"' + (d === selectedDay ? ' selected' : '') + '>' + d + '</option>';
    }
    return opts;
  }
  function buildEthMonthSelect(selectedMonth){
    var opts = '<option value="">' + t("ወር", "Month") + '</option>';
    for (var m = 1; m <= 13; m++){
      opts += '<option value="' + m + '"' + (m === selectedMonth ? ' selected' : '') + '>' + ethMonthName(m) + '</option>';
    }
    return opts;
  }
  function buildEthYearSelect(selectedYear){
    var opts = '<option value="">' + t("ዓ.ም (አማራጭ)", "Year (optional)") + '</option>';
    var thisEthYear = todayEthiopian().year;
    for (var y = thisEthYear - 15; y <= thisEthYear + 2; y++){
      opts += '<option value="' + y + '"' + (y === selectedYear ? ' selected' : '') + '>' + y + '</option>';
    }
    return opts;
  }

  function openProfileSheet(){
    var p = state.profile || {};
    var b = p.birthday || {};
    var gnd = p.gender || "";
    var html = ''
      + '<div class="fw-overlay" id="fw-overlay">'
      + '  <div class="fw-sheet">'
      + '    <h3>' + t("ስለ ራስዎ ንገሩን", "Tell us about you") + '</h3>'
      + '    <p class="hint">' + t("ስምዎ፣ የሚማሩበት ዩኒቨርሲቲ እና ከተማ — በ አድራሻ ዝርዝር ውስጥ ለሌሎች ተማሪዎች ይታያል።", "Your name, university and city — this will be visible to other students in the Directory.") + '</p>'
      + '    <div class="fw-inline-actions" style="margin:0 0 10px;">'
      + '      <button type="button" class="fw-btn ' + (gnd==="m"?"gold":"ghost") + '" id="pf-gender-m" data-g="m">' + t("ወንድም", "Brother") + '</button>'
      + '      <button type="button" class="fw-btn ' + (gnd==="f"?"gold":"ghost") + '" id="pf-gender-f" data-g="f">' + t("እህት", "Sister") + '</button>'
      + '    </div>'
      + '    <input class="fw-input" id="pf-name" placeholder="' + t("ሙሉ ስም", "Full name") + '" value="' + escapeHtml(p.name||"") + '">'
      + '    <input class="fw-input" id="pf-uni" placeholder="' + t("ዩኒቨርሲቲ", "University") + '" value="' + escapeHtml(p.university||"") + '">'
      + '    <input class="fw-input" id="pf-city" placeholder="' + t("ከተማ", "City") + '" value="' + escapeHtml(p.city||"") + '">'
      + '    <div style="display:flex;gap:6px;">'
      + '      <select class="fw-input" id="pf-bday" style="flex:1;">' + buildEthDaySelect(b.day, b.month) + '</select>'
      + '      <select class="fw-input" id="pf-bmonth" style="flex:1.4;">' + buildEthMonthSelect(b.month) + '</select>'
      + '      <select class="fw-input" id="pf-byear" style="flex:1.1;">' + buildEthYearSelect(b.year) + '</select>'
      + '    </div>'
      + '    <div class="fw-inline-actions">'
      + '      <button class="fw-btn gold" id="pf-save">' + t("አስቀምጥ", "Save") + '</button>'
      + (state.profile ? '<button class="fw-btn ghost" id="pf-cancel">' + t("ተወው", "Cancel") + '</button>' : '')
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.getElementById("fw-root").insertAdjacentHTML("beforeend", html);

    var chosenGender = gnd;
    function paintGenderBtns(){
      document.getElementById("pf-gender-m").className = "fw-btn " + (chosenGender==="m"?"gold":"ghost");
      document.getElementById("pf-gender-f").className = "fw-btn " + (chosenGender==="f"?"gold":"ghost");
    }
    document.getElementById("pf-gender-m").onclick = function(){ chosenGender = "m"; paintGenderBtns(); };
    document.getElementById("pf-gender-f").onclick = function(){ chosenGender = "f"; paintGenderBtns(); };

    var monthSel = document.getElementById("pf-bmonth");
    monthSel.onchange = function(){
      var daySel = document.getElementById("pf-bday");
      var curDay = parseInt(daySel.value, 10) || null;
      daySel.innerHTML = buildEthDaySelect(curDay, parseInt(monthSel.value,10) || 1);
    };

    document.getElementById("pf-save").onclick = async function(){
      var name = document.getElementById("pf-name").value.trim();
      var uni = document.getElementById("pf-uni").value.trim();
      var city = document.getElementById("pf-city").value.trim();
      if (!name){ toast(t("እባክዎ ስም ያስገቡ", "Please enter your name")); return; }
      if (!chosenGender){ toast(t("እባክዎ ወንድም ወይም እህት የሚለውን ይምረጡ", "Please select Brother or Sister")); return; }
      var bd = parseInt(document.getElementById("pf-bday").value, 10) || null;
      var bm = parseInt(document.getElementById("pf-bmonth").value, 10) || null;
      var by = parseInt(document.getElementById("pf-byear").value, 10) || null;
      var birthday = (bd && bm) ? { day: bd, month: bm, year: by } : null;
      var saveBtn = document.getElementById("pf-save");
      saveBtn.disabled = true;
      state.profile = { name: name, university: uni, city: city, gender: chosenGender, birthday: birthday };
      var ok = await DB.saveMyProfile(state.userId, state.profile);
      if (!ok){
        saveBtn.disabled = false;
        toast(t("አልተሳካም — እንደገና ይሞክሩ", "Something went wrong — please try again"));
        return;
      }
      state.directory = await DB.getDirectory();
      closeOverlay();
      renderUserline();
      render();
      toast(t("ተቀምጧል!", "Saved!"));
    };
    var cancelBtn = document.getElementById("pf-cancel");
    if (cancelBtn) cancelBtn.onclick = closeOverlay;
  }
  function closeOverlay(){
    var ov = document.getElementById("fw-overlay");
    if (ov) ov.remove();
  }
  function renderUserline(){
    var el = document.getElementById("fw-userline-text");
    if (state.profile && state.profile.name){
      el.textContent = tg("እንኳን ደህና መጣህ, ", "እንኳን ደህና መጣሽ, ", "እንኳን ደህና መጣህ, ", "Welcome, ") + state.profile.name;
    } else {
      el.textContent = t("እንኳን ደህና መጣችሁ", "Welcome");
    }
  }

  /* ================= render root ================= */
  function render(){
    var main = document.getElementById("fw-main");
    if (state.tab === "feed") main.innerHTML = renderFeed();
    else if (state.tab === "events") main.innerHTML = renderEvents();
    else if (state.tab === "spiritual") main.innerHTML = renderSpiritual();
    else if (state.tab === "group") main.innerHTML = renderGroup();
    else if (state.tab === "directory") main.innerHTML = renderDirectory();
    wireTabHandlers();
  }

  /* ---------------- FEED ---------------- */
  function renderFeed(){
    var list = state.feed.slice().sort(function(a,b){ return b.time - a.time; });
    var items = list.length ? list.map(function(p){
      return '<div class="fw-card">'
        + '<div class="fw-row-top"><span class="fw-name">' + escapeHtml(p.author) + '</span>'
        + '<span class="fw-meta">' + fmtDate(new Date(p.time).toISOString()) + '</span></div>'
        + '<p class="fw-body-text">' + escapeHtml(p.text) + '</p>'
        + '</div>';
    }).join("") : '<div class="fw-empty">' + t("እስካሁን ምንም ልጥፍ የለም።", "No posts yet.") + '</div>';

    var today = todayEthiopian();
    var birthdayPeople = state.directory.filter(function(d){
      return d.birthday && d.birthday.day === today.day && d.birthday.month === today.month;
    });
    var birthdayBanner = "";
    if (birthdayPeople.length){
      var names = birthdayPeople.map(function(d){ return d.name; }).join("፣ ");
      birthdayBanner = '<div class="fw-card accent-green">'
        + '<p class="fw-body-text" style="margin-top:0;">🎉 ' + t("ዛሬ የ", "Today is ") + escapeHtml(names) + t(" ልደት ቀን ነው! እንኳን ደስ አላችሁ በማለት አትርሱ።", "'s birthday! Don't forget to wish them well.") + '</p>'
        + '</div>';
    }

    return ''
      + '<h2 class="fw-section-title">' + t("ዜና", "Feed") + '</h2>'
      + '<p class="fw-section-sub">' + t("ከሰንበት ትምህርት ቤቱ ወቅታዊ ዜናዎችና ፎቶዎች — ዛሬ ", "Updates and photos from the Sunday School — today is ") + fmtEthDate(today) + ' ' + t("(በኢትዮጵያ አቆጣጠር)።", "(Ethiopian calendar).") + '</p>'
      + birthdayBanner
      + items
      + '<div class="fw-fab-row"><button class="fw-btn gold" id="feed-new-btn">+ ' + t("አዲስ ልጥፍ", "New post") + '</button></div>';
  }

  function openNewPostSheet(){
    var html = ''
      + '<div class="fw-overlay" id="fw-overlay"><div class="fw-sheet">'
      + '<h3>' + t("አዲስ ልጥፍ", "New post") + '</h3>'
      + '<p class="hint">' + t("ይህ ልጥፍ ለሁሉም የ ሰንበት ትምህርት ቤቱ ተማሪዎች ይታያል።", "This post will be visible to everyone in the Sunday School.") + '</p>'
      + '<textarea class="fw-input" id="np-text" placeholder="' + t("ምን ልትካፈሉን ትፈልጋላችሁ?", "What do you want to share?") + '"></textarea>'
      + '<div class="fw-inline-actions"><button class="fw-btn gold" id="np-save">' + t("ለጥፍ", "Post") + '</button>'
      + '<button class="fw-btn ghost" id="np-cancel">' + t("ተወው", "Cancel") + '</button></div>'
      + '</div></div>';
    document.getElementById("fw-root").insertAdjacentHTML("beforeend", html);
    document.getElementById("np-cancel").onclick = closeOverlay;
    document.getElementById("np-save").onclick = async function(){
      var text = document.getElementById("np-text").value.trim();
      if (!text) return;
      var ok = await DB.createPost(state.userId, text);
      if (!ok){ toast(t("አልተሳካም — እንደገና ይሞክሩ", "Something went wrong — please try again")); return; }
      state.feed = await DB.getFeed();
      closeOverlay();
      render();
      toast(t("ተለጥፏል!", "Posted!"));
    };
  }

  /* ---------------- EVENTS ---------------- */
  function renderEvents(){
    var list = state.events.slice().sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
    var items = list.length ? list.map(function(e){
      var joined = state.rsvps.indexOf(e.id) !== -1;
      var title = LANG === "am" ? (e.title_am || e.title_en) : (e.title_en || e.title_am);
      var isBreak = e.type === "break";
      return '<div class="fw-card' + (isBreak ? ' accent-gold' : '') + '">'
        + '<div class="fw-row-top"><span class="fw-name">' + escapeHtml(title) + '</span>'
        + '<span class="fw-meta">' + fmtDate(e.date) + '</span></div>'
        + (isBreak && e.note ? '<p class="fw-body-text">' + escapeHtml(e.note) + '</p>' : '')
        + '<div class="fw-inline-actions">'
        + '<button class="fw-btn ' + (joined ? 'ghost' : 'small') + '" data-rsvp="' + e.id + '">'
        + (joined ? t("✓ ተመዝግቤያለሁ", "✓ You're going") : t("እገኛለሁ", "I'll be there"))
        + '</button></div>'
        + '</div>';
    }).join("") : '<div class="fw-empty">' + t("ምንም መርሐ ግብር የለም።", "No events yet.") + '</div>';

    return ''
      + '<h2 class="fw-section-title">' + t("መርሐ ግብር", "Events") + '</h2>'
      + '<p class="fw-section-sub">' + t("ስብሰባዎችና ጉባኤያት፣ እና ወደ ቤት ስትመለሱ ማሳወቅ የምትችሉበት።", "Meetings and assemblies, plus a way to let us know when you're coming home.") + '</p>'
      + items
      + '<div class="fw-fab-row" style="display:flex;gap:8px;">'
      + '<button class="fw-btn gold" id="evt-break-btn">🏠 ' + t("ለዕረፍት እየመጣሁ ነው", "I'm coming home for break") + '</button>'
      + '</div>';
  }

  function openBreakSheet(){
    var html = ''
      + '<div class="fw-overlay" id="fw-overlay"><div class="fw-sheet">'
      + '<h3>' + t("ለዕረፍት እየመጣሁ ነው", "Coming home for break") + '</h3>'
      + '<p class="hint">' + tg("ክፍል ተጠሪዎች ቀድመው እንዲያውቁ እና በእንቅስቃሴዎች ውስጥ እንዲያሳትፉህ ይረዳል።", "ክፍል ተጠሪዎች ቀድመው እንዲያውቁ እና በእንቅስቃሴዎች ውስጥ እንዲያሳትፉሽ ይረዳል።", "ክፍል ተጠሪዎች ቀድመው እንዲያውቁ እና በእንቅስቃሴዎች ውስጥ እንዲያሳትፉዎት ይረዳል።", "This lets class leaders know ahead of time so they can involve you while you're back.") + '</p>'
      + '<input class="fw-input" id="bk-from" type="date">'
      + '<input class="fw-input" id="bk-to" type="date">'
      + '<textarea class="fw-input" id="bk-note" placeholder="' + t("ማስታወሻ (አማራጭ)", "Note (optional)") + '"></textarea>'
      + '<div class="fw-inline-actions"><button class="fw-btn gold" id="bk-save">' + t("አሳውቅ", "Let them know") + '</button>'
      + '<button class="fw-btn ghost" id="bk-cancel">' + t("ተወው", "Cancel") + '</button></div>'
      + '</div></div>';
    document.getElementById("fw-root").insertAdjacentHTML("beforeend", html);
    document.getElementById("bk-cancel").onclick = closeOverlay;
    document.getElementById("bk-save").onclick = async function(){
      var from = document.getElementById("bk-from").value;
      var to = document.getElementById("bk-to").value;
      var note = document.getElementById("bk-note").value.trim();
      if (!from){ toast(t("እባክዎ ቀን ይምረጡ", "Please choose a date")); return; }
      var name = (state.profile && state.profile.name) ? state.profile.name : t("ስም ያልገለጸ", "A student");
      var title_am = name + " " + gt("ወደ ቤት እየመጣ ነው", "ወደ ቤት እየመጣች ነው", "ወደ ቤት እየመጣ ነው") + " (" + from + (to ? " – "+to : "") + ")";
      var title_en = name + " is coming home (" + from + (to ? " – "+to : "") + ")";
      var ok = await DB.createEvent(state.userId, { title_am: title_am, title_en: title_en, date: from, type: "break", note: note });
      if (!ok){ toast(t("አልተሳካም — እንደገና ይሞክሩ", "Something went wrong — please try again")); return; }
      state.events = await DB.getEvents();
      closeOverlay();
      state.tab = "events";
      render();
      toast(t("አመሰግናለሁ! ተልኳል።", "Thanks — sent!"));
    };
  }

  async function toggleRsvp(id){
    var joining = state.rsvps.indexOf(id) === -1;
    await DB.setRsvp(state.userId, id, joining);
    state.rsvps = await DB.getMyRsvps(state.userId);
    render();
  }

  /* ---------------- SPIRITUAL ---------------- */
  function renderSpiritual(){
    var v = todaysVerse();
    var verseText = LANG === "am" ? v.am : v.en;

    var prayerItems = state.prayers.length ? state.prayers.map(function(p){
      var already = state.prayed.indexOf(p.id) !== -1;
      return '<div class="fw-card accent-wine">'
        + '<p class="fw-body-text" style="margin-top:0;">' + escapeHtml(p.text) + '</p>'
        + '<div class="fw-inline-actions">'
        + '<button class="fw-btn ' + (already ? 'ghost' : 'small') + '" data-pray="' + p.id + '" ' + (already ? 'disabled' : '') + '>'
        + '🙏 ' + t("እጸልያለሁ", "I'm praying") + ' (' + (p.prayCount||0) + ')'
        + '</button></div>'
        + '</div>';
    }).join("") : '<div class="fw-empty">' + t("ምንም የጸሎት ጥያቄ የለም።", "No prayer requests yet.") + '</div>';

    var checkedCount = state.readChecked.length;
    var pct = Math.round((checkedCount / READING_PLAN.length) * 100);
    var days = READING_PLAN.map(function(r, i){
      var done = state.readChecked.indexOf(i) !== -1;
      return '<div class="fw-day-row" data-day="' + i + '">'
        + '<span class="fw-day-idx' + (done?' done':'') + '">' + (done ? "✓" : (i+1)) + '</span>'
        + '<span class="fw-day-label' + (done?' done':'') + '">' + escapeHtml(LANG === "am" ? r.am : r.en) + '</span>'
        + '</div>';
    }).join("");

    return ''
      + '<h2 class="fw-section-title">' + t("መንፈሳዊ ሕይወት", "Spiritual Life") + '</h2>'
      + '<p class="fw-section-sub">' + t("የዕለቱ ቃል፣ የጸሎት ግንብ እና ሳምንታዊ የንባብ እቅድ።", "Daily verse, prayer wall, and a weekly reading plan.") + '</p>'

      + '<div class="fw-verse"><p class="fw-verse-text fw-serif">"' + escapeHtml(verseText) + '"</p><p class="fw-verse-ref">' + v.ref + '</p></div>'

      + '<h3 class="fw-serif" style="color:var(--green);font-size:15px;margin:0 0 8px;">' + t("የጸሎት ግንብ", "Prayer wall") + '</h3>'
      + prayerItems
      + '<div class="fw-inline-actions" style="margin-bottom:20px;"><button class="fw-btn ghost small" id="pw-new-btn">+ ' + t("የጸሎት ጥያቄ አክል", "Add a request") + '</button></div>'

      + '<div class="fw-divider"></div>'

      + '<h3 class="fw-serif" style="color:var(--green);font-size:15px;margin:0 0 4px;">' + t("ሳምንታዊ የንባብ እቅድ", "Weekly reading plan") + '</h3>'
      + '<div class="fw-progress-wrap"><div class="fw-progress-bar" style="width:' + pct + '%"></div></div>'
      + '<p class="fw-meta" style="margin:0 0 8px;">' + checkedCount + '/' + READING_PLAN.length + ' ' + t("ተነብቧል", "read") + '</p>'
      + days;
  }

  function openPrayerSheet(){
    var html = ''
      + '<div class="fw-overlay" id="fw-overlay"><div class="fw-sheet">'
      + '<h3>' + t("የጸሎት ጥያቄ", "Prayer request") + '</h3>'
      + '<textarea class="fw-input" id="pw-text" placeholder="' + tg("ምን ልንጸልይልህ እንፈልጋለን?", "ምን ልንጸልይልሽ እንፈልጋለን?", "ምን ልንጸልይልዎ እንፈልጋለን?", "What should we pray for?") + '"></textarea>'
      + '<label class="fw-check"><input type="checkbox" id="pw-anon" checked> ' + t("ስም ሳልገልጽ ለጥፍ", "Post anonymously") + '</label>'
      + '<div class="fw-inline-actions"><button class="fw-btn gold" id="pw-save">' + t("ላክ", "Send") + '</button>'
      + '<button class="fw-btn ghost" id="pw-cancel">' + t("ተወው", "Cancel") + '</button></div>'
      + '</div></div>';
    document.getElementById("fw-root").insertAdjacentHTML("beforeend", html);
    document.getElementById("pw-cancel").onclick = closeOverlay;
    document.getElementById("pw-save").onclick = async function(){
      var text = document.getElementById("pw-text").value.trim();
      if (!text) return;
      var anon = document.getElementById("pw-anon").checked;
      var ok = await DB.createPrayerRequest(state.userId, text, anon);
      if (!ok){ toast(t("አልተሳካም — እንደገና ይሞክሩ", "Something went wrong — please try again")); return; }
      state.prayers = await DB.getPrayerWall();
      closeOverlay();
      render();
      toast(t("ተልኳል 🙏", "Sent 🙏"));
    };
  }

  async function prayFor(id){
    if (state.prayed.indexOf(id) !== -1) return;
    await DB.prayForRequest(state.userId, id);
    state.prayers = await DB.getPrayerWall();
    state.prayed = await DB.getMyPrayed(state.userId);
    render();
  }

  async function toggleReadDay(i){
    var checking = state.readChecked.indexOf(i) === -1;
    await DB.setReadingCheck(state.userId, i, checking);
    state.readChecked = await DB.getMyReadingChecks(state.userId);
    render();
  }

  /* ---------------- GROUP ---------------- */
  function renderGroup(){
    var ch = thisWeekChallenge();
    var chText = challengeText(ch);
    var myName = (state.profile && state.profile.name) || null;
    var myDone = myName && state.challengeDone.indexOf(myName) !== -1;

    var roster = state.directory.length ? state.directory : [];
    var doneCount = state.challengeDone.length;
    var total = Math.max(roster.length, doneCount, 1);
    var pct = Math.round((doneCount/total)*100);

    var rosterHtml = roster.length ? roster.map(function(m){
      var done = state.challengeDone.indexOf(m.name) !== -1;
      return '<div class="fw-roster-item"><span class="fw-dot' + (done?' done':'') + '"></span>'
        + '<span>' + escapeHtml(m.name) + (m.name===myName ? ' <span class="fw-tag">' + tg("አንተ", "አንቺ", "እርስዎ", "you") + '</span>' : '') + '</span></div>';
    }).join("") : '<div class="fw-empty">' + t("እስካሁን ማንም አልተመዘገበም — ከ አድራሻ ትር ገለጫዎን ይሙሉ።", "No one's registered yet — fill in your info from the Directory tab.") + '</div>';

    return ''
      + '<h2 class="fw-section-title">' + t("ንዑስ ቤተሰብ", "My Small Group") + '</h2>'
      + '<p class="fw-section-sub">' + t("ትንሽ ቡድን፣ ትልቅ ግንኙነት — በየሳምንቱ አንድ ቀላል ነገር አብረን እናደርጋለን።", "Small group, real connection — one simple thing we do together each week.") + '</p>'

      + '<div class="fw-card accent-green">'
      + '<p class="fw-meta" style="margin:0 0 4px;">' + t("የዚህ ሳምንት ተግባር", "This week's challenge") + '</p>'
      + '<p class="fw-body-text" style="margin-top:0;font-size:14px;">' + escapeHtml(chText) + '</p>'
      + '<div class="fw-inline-actions">'
      + '<button class="fw-btn ' + (myDone ? 'ghost' : 'gold') + '" id="ch-done-btn" ' + (myDone || !myName ? 'disabled' : '') + '>'
      + (myDone ? tg("✓ ጨርሰሃል", "✓ ጨርሰሻል", "✓ ጨርሰዋል", "✓ Done") : t("ጨረስኩ", "I did it"))
      + '</button>'
      + (!myName ? '<span class="fw-meta">' + t("(ስም ለማስመዝገብ አድራሻ ትር ይሂዱ)", "(add your name in Directory first)") + '</span>' : '')
      + '</div>'
      + '</div>'

      + '<div class="fw-progress-wrap"><div class="fw-progress-bar" style="width:' + pct + '%"></div></div>'
      + '<p class="fw-meta" style="margin:0 0 14px;">' + doneCount + '/' + roster.length + ' ' + t("ጨርሰዋል", "have checked in") + '</p>'

      + rosterHtml;
  }

  async function markChallengeDone(){
    if (!state.profile) return;
    var wk = weekKey();
    await DB.markWeekDone(state.userId, wk);
    state.challengeDone = await DB.getWeekCompletions(wk);
    render();
    toast(t("በጎ ስራ! 🎉", "Nice work! 🎉"));
  }

  /* ---------------- DIRECTORY ---------------- */
  var dirFilter = "";
  function renderDirectory(){
    var myUni = state.profile && state.profile.university;
    var list = state.directory.filter(function(d){
      if (!dirFilter) return true;
      var f = dirFilter.toLowerCase();
      return (d.name||"").toLowerCase().indexOf(f) !== -1
        || (d.university||"").toLowerCase().indexOf(f) !== -1
        || (d.city||"").toLowerCase().indexOf(f) !== -1;
    });

    var items = list.length ? list.map(function(d){
      var sameUni = myUni && d.university && d.university.trim().toLowerCase() === myUni.trim().toLowerCase();
      var bstr = fmtEthDate(d.birthday);
      return '<div class="fw-dir-item">'
        + '<span class="fw-dir-name">' + escapeHtml(d.name) + '</span>'
        + (sameUni ? '<span class="fw-tag">' + tg("እንደ አንተ", "እንደ አንቺ", "እንደ እርስዎ", "same as you") + '</span>' : '')
        + '<div class="fw-dir-meta">' + escapeHtml(d.university||"—") + (d.city ? " · " + escapeHtml(d.city) : "") + (bstr ? " · 🎂 " + bstr : "") + '</div>'
        + '</div>';
    }).join("") : '<div class="fw-empty">' + t("ምንም አልተገኘም።", "No matches.") + '</div>';

    return ''
      + '<h2 class="fw-section-title">' + t("አድራሻ", "Directory") + '</h2>'
      + '<p class="fw-section-sub">' + tg("በዩኒቨርሲቲህ ወይም ከተማህ ያሉ ወንድሞችና እህቶች ፈልግ።", "በዩኒቨርሲቲሽ ወይም ከተማሽ ያሉ ወንድሞችና እህቶች ፈልጊ።", "በዩኒቨርሲቲዎ ወይም ከተማዎ ያሉ ወንድሞችና እህቶች ይፈልጉ።", "Find brothers and sisters at your university or in your city.") + '</p>'
      + '<input class="fw-input" id="dir-search" placeholder="' + t("ፈልግ… ስም፣ ዩኒቨርሲቲ ወይም ከተማ", "Search name, university, or city") + '" value="' + escapeHtml(dirFilter) + '">'
      + '<p class="fw-meta" style="margin:0 0 10px;">' + t("ይህ ዝርዝር ገለጫቸውን ለሞሉ ተማሪዎች ብቻ ይታያል።", "This list only shows students who've filled in their info.") + '</p>'
      + items
      + (needsProfile() ? '<div class="fw-fab-row"><button class="fw-btn gold" id="dir-add-me-btn">+ ' + t("ራሴን ጨምር", "Add myself") + '</button></div>' : '');
  }

  /* ================= event wiring ================= */
  function wireTabHandlers(){
    // feed
    var fb = document.getElementById("feed-new-btn");
    if (fb) fb.onclick = openNewPostSheet;

    // events
    document.querySelectorAll("[data-rsvp]").forEach(function(btn){
      btn.onclick = function(){ toggleRsvp(btn.getAttribute("data-rsvp")); };
    });
    var eb = document.getElementById("evt-break-btn");
    if (eb) eb.onclick = openBreakSheet;

    // spiritual
    var pwb = document.getElementById("pw-new-btn");
    if (pwb) pwb.onclick = openPrayerSheet;
    document.querySelectorAll("[data-pray]").forEach(function(btn){
      btn.onclick = function(){ prayFor(btn.getAttribute("data-pray")); };
    });
    document.querySelectorAll("[data-day]").forEach(function(row){
      row.onclick = function(){ toggleReadDay(parseInt(row.getAttribute("data-day"),10)); };
    });

    // group
    var chb = document.getElementById("ch-done-btn");
    if (chb) chb.onclick = markChallengeDone;

    // directory
    var ds = document.getElementById("dir-search");
    if (ds) ds.oninput = function(){ dirFilter = ds.value; render(); setTimeout(function(){
      var f = document.getElementById("dir-search"); if (f){ f.focus(); f.setSelectionRange(f.value.length,f.value.length); }
    },0); };
    var dam = document.getElementById("dir-add-me-btn");
    if (dam) dam.onclick = openProfileSheet;
  }

  function wireTabs(){
    document.querySelectorAll(".fw-tab").forEach(function(tabEl){
      tabEl.onclick = function(){
        document.querySelectorAll(".fw-tab").forEach(function(x){ x.classList.remove("active"); });
        tabEl.classList.add("active");
        state.tab = tabEl.getAttribute("data-tab");
        render();
      };
    });
  }

  /* ================= boot ================= */
  async function boot(){
    try{
      await Auth.ensureSession();
      state.userId = await Auth.getUserId();
    }catch(e){
      document.getElementById("fw-main").innerHTML =
        '<div class="fw-empty">' + t(
          "ከአገልጋዩ ጋር መገናኘት አልተቻለም። እባክዎ የ config.js ውቅርን ያረጋግጡ (Supabase URL/anon key) እና ገጹን እንደገና ይሞክሩ።",
          "Couldn't connect to the backend. Please check your config.js Supabase URL/anon key and reload."
        ) + '</div>';
      return;
    }

    await loadProfile();

    state.feed = await DB.getFeed();
    state.events = await DB.getEvents();
    state.rsvps = await DB.getMyRsvps(state.userId);
    state.prayers = await DB.getPrayerWall();
    state.prayed = await DB.getMyPrayed(state.userId);
    state.readChecked = await DB.getMyReadingChecks(state.userId);
    state.directory = await DB.getDirectory();
    state.challengeDone = await DB.getWeekCompletions(weekKey());

    applyStaticLang();
    renderUserline();
    wireTabs();
    render();

    document.getElementById("fw-lang-toggle").onclick = function(){
      LANG = LANG === "am" ? "en" : "am";
      applyStaticLang();
      renderUserline();
      render();
    };
    document.getElementById("fw-edit-profile").onclick = openProfileSheet;

    if (needsProfile()){
      setTimeout(openProfileSheet, 400);
    }
  }

  boot();
})();
