/**
 * This function serves the 'Index.html' file as the main web application.
 * Also acts as a JSON API if parameters are provided.
 */
function doGet(e) {
  // 1. Check if user is requesting JSON data via API
  if (e && e.parameter && e.parameter.action === 'getStockData') {
    var stock = e.parameter.stock;
    var date = e.parameter.date;
    var range = e.parameter.range;
    
    var result = getStockData(stock, date, range);
    
    // Return as JSON for cross-domain fetch
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Default: Serve the HTML page
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('NSE Historical Stock Data Explorer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Fetches real stock data from Google Finance.
 */
function getStockData(stockName, dateStr, rangeDays) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mainSheet = ss.getActiveSheet();
    var workerSheet = ss.getSheetByName("Worker") || ss.insertSheet("Worker");
    
    rangeDays = parseInt(rangeDays) || 15;
    stockName = stockName.toUpperCase().trim();
    
    var targetDateObj = new Date(dateStr);
    if (isNaN(targetDateObj.getTime())) return { error: "Invalid date: " + dateStr };

    // 1. Log to Audit Trace
    var peFormula = '=GOOGLEFINANCE("NSE:' + stockName + '", "pe")';
    mainSheet.appendRow([stockName, dateStr, "REQUESTED", peFormula]);
    var logRow = mainSheet.getLastRow();
    
    // 2. Prepare Detailed Range
    var startDate = new Date(targetDateObj);
    startDate.setDate(targetDateObj.getDate() - rangeDays);
    var endDate = new Date(targetDateObj);
    endDate.setDate(targetDateObj.getDate() + rangeDays);
    
    var startStr = Utilities.formatDate(startDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
    var endStr = Utilities.formatDate(endDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
    var formula = '=GOOGLEFINANCE("NSE:' + stockName + '", "all", "' + startStr + '", "' + endStr + '")';
    
    // 3. Polling with Validation
    workerSheet.clear();
    SpreadsheetApp.flush();
    workerSheet.getRange("A1").setFormula(formula);
    
    var dataRows = [];
    var calculated = false;
    for (var i = 0; i < 15; i++) {
      Utilities.sleep(1000);
      SpreadsheetApp.flush();
      dataRows = workerSheet.getDataRange().getValues();
      if (dataRows.length > 1 && (dataRows[1][0] instanceof Date)) {
        calculated = true;
        break;
      }
      if (dataRows[0][0] === "#N/A") {
        return { error: "Stock symbol 'NSE:" + stockName + "' not recognized." };
      }
    }
    
    if (!calculated) return { error: "Timeout fetching data." };
    
    // 4. Process Grid
    var historyData = [];
    var targetPrice = null;

    for (var j = 1; j < dataRows.length; j++) {
      var row = dataRows[j];
      if (!(row[0] instanceof Date)) continue;
      var closePrice = parseFloat(row[4]);
      if (isNaN(closePrice)) continue;

      var o = parseFloat(row[1]) || closePrice;
      var h = parseFloat(row[2]) || closePrice;
      var l = parseFloat(row[3]) || closePrice;
      var d = row[0];
      var isoDateStr = Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      
      var point = {
        x: isoDateStr,
        t: d.getTime(),
        o: parseFloat(o.toFixed(2)),
        h: parseFloat(Math.max(h, o, closePrice).toFixed(2)),
        l: parseFloat(Math.min(l, o, closePrice).toFixed(2)),
        c: parseFloat(closePrice.toFixed(2))
      };
      
      if (isoDateStr === dateStr) targetPrice = point.c;
      historyData.push(point);
    }
    
    if (!targetPrice && historyData.length > 0) targetPrice = historyData[historyData.length - 1].c;

    mainSheet.getRange(logRow, 3).setValue(targetPrice);
    var peResult = mainSheet.getRange(logRow, 4).getValue();

    return {
      stock: stockName,
      date: Utilities.formatDate(targetDateObj, ss.getSpreadsheetTimeZone(), 'dd MMMM yyyy'),
      price: targetPrice,
      peRatio: (typeof peResult === 'number' && !isNaN(peResult)) ? parseFloat(peResult.toFixed(2)) : "N/A",
      history: historyData
    };

  } catch (err) {
    return { error: err.toString() };
  }
}
