const RETRY_DELAY = 5000;
const MAX_RETRIES = 3;
const DEBUG = true;
let numberOfOpenedCases = 0;
let foundFirstGold = false;
let skinStats = {};
let knifePulls = [];
const totalPulls = [];

// Stats tracking
let stats = {
  totalCases: 0,
  gold: 0,
  covert: 0,
  classified: 0,
  restricted: 0,
  milspec: 0,
  stattrak: 0,
  casesSinceGold: 0,
  entriesScanned: 0,
  lastKnownDate: "",
};

function createUI() {
  const container = document.createElement("div");
  container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(23, 26, 33,0.8);
        padding: 15px;
        border-radius: 7px;
        color: #EDF1F3;
        z-index: 9999;
        min-width: 275px;
    `;

  container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: -10px;">
          <div>
              <h3 style="margin: 0;">Case Analyzer</h3>
              <div style="background: #2574A9; height: 3px; width: 65px; margin-top: 2px;">&nbsp;</div>
          </div>
          <div style="display: flex; align-items: center;">
              <div style="text-align: right; margin-right: 15px; font-size: 10px; line-height: 1.2;">
                  CASES<br>OPENED
              </div>
              <div id="total" style="font-size: 30px;">0</div>
          </div>
      </div>
      <div style="padding-top: 10px;">★ Knives/Gloves: <span id="gold">0</span> (<span id="goldPercent">0</span>%)</div>
      <div>Covert: <span id="covert">0</span> (<span id="covertPercent">0</span>%)</div>
      <div>Classified: <span id="classified">0</span> (<span id="classifiedPercent">0</span>%)</div>
      <div>Restricted: <span id="restricted">0</span> (<span id="restrictedPercent">0</span>%)</div>
      <div>Mil-spec: <span id="milspec">0</span> (<span id="milspecPercent">0</span>%)</div>
      <div>StatTrak™: <span id="stattrak">0</span> (<span id="stattrakPercent">0</span>%)</div>
      <div style="display: none;">Cases since gold: <span id="casesSinceGold">0</span></div>
      <div id="pullInfo" style="margin-top:10px; border-top: 1px solid #666; padding-top: 10px; border-bottom: 1px solid #666; padding-bottom: 10px; display: none;">
          <div>Entries Scanned: <span id="entriesScanned">0</span></div>
          <div>Last Date: <span id="lastDate">-</span></div>
      </div>
      <div id="pullArea"></div>
      <button id="analyzeBtn" style="margin-top:20px; width: 100%; padding: 7px 10px; background: #2574A9; border: 1px solid #1C577F; color: #EDF1F3; border-radius: 7px; cursor: pointer;">Analyze History</button>
      <div style="margin-top: 20px; text-align: center;">
          <p style="opacity:70%; font-size: 10px; margin: 0px auto;">Made with ❤️ by<br /><a style="color:#FFFFFF; text-decoration:underline;" target="_blank" href="https://github.com/Laeborg">Jonas Læborg</a></p>
      </div>
    `;

  document.body.appendChild(container);
  document
    .getElementById("analyzeBtn")
    .addEventListener("click", handleButtonClick);
}

function updateDisplay() {
  const total = numberOfOpenedCases || 1;

  document.getElementById("total").textContent = numberOfOpenedCases;
  document.getElementById("gold").textContent = stats.gold;
  document.getElementById("goldPercent").textContent = (
    (stats.gold / total) *
    100
  ).toFixed(2);
  document.getElementById("covert").textContent = stats.covert;
  document.getElementById("covertPercent").textContent = (
    (stats.covert / total) *
    100
  ).toFixed(2);
  document.getElementById("classified").textContent = stats.classified;
  document.getElementById("classifiedPercent").textContent = (
    (stats.classified / total) *
    100
  ).toFixed(2);
  document.getElementById("restricted").textContent = stats.restricted;
  document.getElementById("restrictedPercent").textContent = (
    (stats.restricted / total) *
    100
  ).toFixed(2);
  document.getElementById("milspec").textContent = stats.milspec;
  document.getElementById("milspecPercent").textContent = (
    (stats.milspec / total) *
    100
  ).toFixed(2);
  document.getElementById("stattrak").textContent = stats.stattrak;
  document.getElementById("stattrakPercent").textContent = (
    (stats.stattrak / total) *
    100
  ).toFixed(2);
  document.getElementById("casesSinceGold").textContent = stats.casesSinceGold;
  document.getElementById("entriesScanned").textContent = stats.entriesScanned;
  document.getElementById("lastDate").textContent = stats.lastKnownDate;
  document.getElementById("pullInfo").style.display = "block";
}

function getHistoryCursor() {
  const scripts = document.getElementsByTagName("script");
  const cursorRegex = /g_historyCursor = ([^;]+);/;

  for (const script of scripts) {
    if (script.text.includes("g_historyCursor")) {
      const regexResult = cursorRegex.exec(script.text);
      if (regexResult && regexResult.length === 2) {
        try {
          return JSON.parse(regexResult[1]);
        } catch (e) {
          console.error("Failed to parse g_historyCursor:", e);
        }
      }
    }
  }
  return null;
}

async function loadHistoryPage(cursor, retryCount = 0) {
  if (DEBUG) console.log("Loading page with cursor:", cursor);

  const baseUrl = window.location.href.split("?")[0];
  const params = new URLSearchParams();

  params.append("ajax", "1");
  if (cursor.time) params.append("cursor[time]", cursor.time);
  if (cursor.time_frac) params.append("cursor[time_frac]", cursor.time_frac);
  if (cursor.s) params.append("cursor[s]", cursor.s);

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
      },
      referrer: window.location.href,
      referrerPolicy: "strict-origin-when-cross-origin",
      method: "GET",
      credentials: "include",
    });

    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        if (DEBUG)
          console.log(
            `Rate limited. Waiting ${RETRY_DELAY / 1000} seconds before retry ${retryCount + 1}/${MAX_RETRIES}`,
          );
        document.getElementById("loadingStatus").textContent =
          `Rate limited. Waiting ${RETRY_DELAY / 1000} seconds before retry ${retryCount + 1}/${MAX_RETRIES}...`;

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return loadHistoryPage(cursor, retryCount + 1);
      } else {
        throw new Error("Max retries reached");
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error loading history page:", error);
    return null;
  }
}

function addPullCard(pull, color) {
  const pullArea = document.getElementById("pullArea");
  const card = document.createElement("div");
  card.style.cssText =
    `
    margin: 10px 0;
    padding: 10px;
    background: ` +
    color +
    `
    border-radius: 5px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
`;

  const img = document.createElement("img");
  img.src = `https://community.cloudflare.steamstatic.com/economy/image/${pull.image}`;
  img.style.width = "50px";
  img.style.marginRight = "10px";

  const textContainer = document.createElement("div");
  textContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    flex: 1;
`;

  const name = document.createElement("p");
  name.textContent = pull.name;
  name.style.margin = "0";

  const casesAgo = document.createElement("p");
  casesAgo.textContent =
    numberOfOpenedCases -
    1 +
    " cases ago | " +
    pull.date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    "  " +
    pull.date
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  casesAgo.style.cssText = `
    margin: 5px 0 0 0;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
`;

  textContainer.appendChild(name);
  textContainer.appendChild(casesAgo);

  card.appendChild(img);
  card.appendChild(textContainer);
  pullArea.appendChild(card);
}

function getWeaponSpec(weaponName, descriptions, date, id) {
  if (weaponName.includes("Sticker")) return;

  for (const desc in descriptions["730"]) {
    if (descriptions["730"][desc].name === weaponName) {
      if (weaponName.includes("★")) {
        let wear = "";
        try {
          wear = descriptions["730"][desc].tags.find(
            (tags) => tags.category === "Exterior",
          ).name;
        } catch (error) {
          console.log(error);
        }

        saveSkinStats({
          name: weaponName,
          image: descriptions["730"][desc].icon_url,
          color: "d4af37",
          wear: wear,
          stattrak:
            descriptions["730"][desc].tags.find(
              (tags) =>
                tags.category === "Quality" && tags.name === "StatTrak™",
            ) != undefined,
          date: date,
          id: id,
        });
        return;
      }

      const colorTag = descriptions["730"][desc].tags.find(
        (tags) => tags.category === "Rarity",
      );

      if (colorTag) {
        const color = colorTag.color;
        updateStatsFromColor(color);

        let wear = "";
        try {
          wear = descriptions["730"][desc].tags.find(
            (tags) => tags.category === "Exterior",
          ).name;
        } catch (error) {
          console.log(error);
        }

        saveSkinStats({
          name: weaponName,
          image: descriptions["730"][desc].icon_url,
          color: color,
          wear: wear,
          stattrak:
            descriptions["730"][desc].tags.find(
              (tags) =>
                tags.category === "Quality" && tags.name === "StatTrak™",
            ) != undefined,
          date: date,
          id: id,
        });
      }
      return;
    }
  }
}

function updateStatsFromColor(color) {
  switch (color) {
    case "eb4b4b":
      stats.covert++;
      break;
    case "d32ce6":
      stats.classified++;
      break;
    case "8847ff":
      stats.restricted++;
      break;
    case "4b69ff":
      stats.milspec++;
      break;
  }
}

function saveSkinStats(skin) {
  numberOfOpenedCases++;

  if (skin.color.includes("eb4b4b")) {
    addPullCard(skin, "rgba(235, 75, 75, 0.2);");
  }

  if (skin.stattrak) stats.stattrak++;

  if (skin.name.includes("★")) {
    stats.gold++;
    if (!foundFirstGold) {
      foundFirstGold = true;
      stats.casesSinceGold = numberOfOpenedCases - 1; // Subtract 1 because we count before the gold item
    }
    knifePulls.push(skin);
    addPullCard(skin, "rgba(212, 175, 55, 0.2);");
  }

  updateDisplay();
}

function parseDate(str) {
  if (!str) return new Date();

  // Clean up the string
  str = str.replace(/\n/g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();

  // Log for debugging
  if (DEBUG) console.log("Parsing date string:", str);

  try {
    // Try direct parsing first
    const directDate = new Date(str);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }

    // Handle different date formats
    if (str.includes(" at ")) {
      // Format: "29 Nov, 2023 at 2:46pm"
      const [datePart, timePart] = str.split(" at ");
      const [day, monthYear] = datePart.split(", ");
      const [month, year] = monthYear.split(" ");
      let [time, modifier] = timePart.split(/(am|pm)/i);
      let [hours, minutes] = time.split(":");

      // Convert to 24-hour format
      if (modifier.toLowerCase() === "pm" && hours !== "12") {
        hours = parseInt(hours) + 12;
      } else if (modifier.toLowerCase() === "am" && hours === "12") {
        hours = "00";
      }

      return new Date(`${month} ${day} ${year} ${hours}:${minutes}`);
    } else {
      // Format: "29 Nov 2023 14:46"
      const parts = str.split(" ");
      if (parts.length >= 4) {
        const [day, month, year, time] = parts;
        return new Date(`${month} ${day} ${year} ${time}`);
      }
    }
  } catch (error) {
    console.error("Error parsing date:", str, error);
    return new Date(); // Return current date as fallback
  }

  // Return current date if all parsing fails
  return new Date();
}

async function startAnalysis() {
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.textContent = "Loading & Analyzing...";
  btn.style.cursor = "wait";

  // Reset stats
  stats = {
    totalCases: 0,
    gold: 0,
    covert: 0,
    classified: 0,
    restricted: 0,
    milspec: 0,
    stattrak: 0,
    casesSinceGold: 0,
    entriesScanned: 0,
    lastKnownDate: "",
  };
  numberOfOpenedCases = 0;
  skinStats = {};
  knifePulls = [];
  foundFirstGold = false; // Reset the gold flag

  const cursor = getHistoryCursor();
  if (!cursor) {
    alert("Could not find history cursor. Please refresh and try again.");
    return;
  }

  let hasMore = true;
  let currentCursor = cursor;

  while (hasMore) {
    const data = await loadHistoryPage(currentCursor);
    if (!data || !data.success) break;

    const html = new DOMParser().parseFromString(data.html, "text/html");
    const events = html.querySelectorAll(".tradehistory_event_description");

    // Increment entries scanned for all events
    stats.entriesScanned += events.length;

    // Process events in reverse order (newest to oldest)
    Array.from(events)
      .reverse()
      .forEach((event) => {
        if (event.innerText.includes("Unlocked a container")) {
          const itemGroup = event.parentElement.querySelector(
            ".tradehistory_items_group",
          );
          if (!itemGroup || itemGroup.children.length <= 1) return;

          const dateElement =
            event.parentElement.parentElement.querySelector(
              ".tradehistory_date",
            );
          const date = parseDate(dateElement.innerText.trim());

          const itemNames =
            event.parentElement.querySelectorAll(".history_item_name");
          const lastItem = itemNames[itemNames.length - 1];
          const itemId = lastItem.parentElement.id;

          getWeaponSpec(lastItem.innerText, data.descriptions, date, itemId);
        }
      });

    // Update last known date
    const dates = html.querySelectorAll(".tradehistory_date");
    if (dates.length > 0) {
      stats.lastKnownDate = dates[dates.length - 1].innerText.trim();
    }

    // If we haven't found a gold item yet after processing all items,
    // update cases since gold to total cases
    if (!foundFirstGold) {
      stats.casesSinceGold = numberOfOpenedCases;
    }

    if (data.cursor) {
      currentCursor = data.cursor;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else {
      hasMore = false;
    }
  }

  btn.textContent = "Analysis Complete!";
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "Analyze History";
  }, 2000);
}

function handleButtonClick() {
  startAnalysis();
}

// Initialize
createUI();
