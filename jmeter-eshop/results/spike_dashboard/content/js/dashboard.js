/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 22.03787373774782, "KoPercent": 77.96212626225218};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.21983248154457694, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.25433691756272403, 500, 1500, "POST /api/apply-coupon"], "isController": false}, {"data": [0.002, 500, 1500, "POST /api/login"], "isController": false}, {"data": [0.0017266187050359713, 500, 1500, "POST /api/checkout"], "isController": false}, {"data": [0.0017875017875017875, 500, 1500, "POST /api/cart"], "isController": false}, {"data": [0.25325775874317497, 500, 1500, "GET /api/products?search="], "isController": false}, {"data": [0.0017318516380430077, 500, 1500, "GET /api/orders/my-orders"], "isController": false}, {"data": [0.2519000313113774, 500, 1500, "GET /api/products/:id"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 162012, 126308, 77.96212626225218, 124.48293336295889, 0, 563, 144.0, 194.0, 215.0, 497.0, 678.3342684162486, 1240.8105492465081, 39.95928578550105], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["POST /api/apply-coupon", 6975, 5195, 74.48028673835125, 128.10752688172053, 1, 563, 159.0, 189.0, 202.0, 233.23999999999978, 29.413873227260652, 53.52180889785479, 2.175244548945107], "isController": false}, {"data": ["POST /api/login", 500, 499, 99.8, 12.014000000000003, 0, 195, 2.0, 20.900000000000034, 63.94999999999999, 188.85000000000014, 5.5965346257597295, 4.369844192476019, 1.164407124108752], "isController": false}, {"data": ["POST /api/checkout", 6950, 6938, 99.8273381294964, 122.98705035971199, 0, 520, 156.0, 186.0, 194.0, 220.0, 29.37111994827302, 53.438335967577665, 2.176243656947432], "isController": false}, {"data": ["POST /api/cart", 6993, 6980, 99.81409981409982, 123.80551980551974, 0, 541, 157.0, 186.0, 194.0, 221.0, 29.458226440369522, 53.103991649184664, 2.1577865205339806], "isController": false}, {"data": ["GET /api/products?search=", 98534, 73520, 74.61383887795076, 124.72413583128576, 0, 563, 127.0, 191.0, 201.0, 427.0, 413.3605735548909, 758.9512295659009, 23.554233740293576], "isController": false}, {"data": ["GET /api/orders/my-orders", 6929, 6917, 99.8268148361957, 124.53470919324556, 0, 537, 158.0, 187.0, 194.0, 215.69999999999982, 29.32277053419156, 53.0094768232572, 1.635129823826391], "isController": false}, {"data": ["GET /api/products/:id", 35131, 26259, 74.74595086960234, 125.10805271697338, 0, 558, 164.0, 195.0, 207.0, 240.9900000000016, 147.61730682768388, 271.3580673852458, 7.965475792795405], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 119105, 94.29727333185546, 73.5161592968422], "isController": false}, {"data": ["403/Forbidden", 5169, 4.092377363270735, 3.190504407080957], "isController": false}, {"data": ["401/Unauthorized", 376, 0.2976850239098078, 0.23208157420437991], "isController": false}, {"data": ["Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 1658, 1.3126642809639928, 1.0233809841246329], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 162012, 126308, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 119105, "403/Forbidden", 5169, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 1658, "401/Unauthorized", 376, "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["POST /api/apply-coupon", 6975, 5195, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 5140, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 55, "", "", "", "", "", ""], "isController": false}, {"data": ["POST /api/login", 500, 499, "401/Unauthorized", 376, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 123, "", "", "", "", "", ""], "isController": false}, {"data": ["POST /api/checkout", 6950, 6938, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 5169, "403/Forbidden", 1679, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 90, "", "", "", ""], "isController": false}, {"data": ["POST /api/cart", 6993, 6980, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 5170, "403/Forbidden", 1742, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 68, "", "", "", ""], "isController": false}, {"data": ["GET /api/products?search=", 98534, 73520, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 72515, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 1005, "", "", "", "", "", ""], "isController": false}, {"data": ["GET /api/orders/my-orders", 6929, 6917, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 5109, "403/Forbidden", 1748, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 60, "", "", "", ""], "isController": false}, {"data": ["GET /api/products/:id", 35131, 26259, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 25879, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 380, "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
