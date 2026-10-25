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

    var data = {"OkPercent": 22.428996306827468, "KoPercent": 77.57100369317253};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.22227342549923196, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.24920249126538052, 500, 1500, "POST /api/apply-coupon"], "isController": false}, {"data": [0.006, 500, 1500, "POST /api/login"], "isController": false}, {"data": [0.0032789385389659907, 500, 1500, "POST /api/checkout"], "isController": false}, {"data": [0.0033318188702105103, 500, 1500, "POST /api/cart"], "isController": false}, {"data": [0.25628486366225645, 500, 1500, "GET /api/products?search="], "isController": false}, {"data": [0.0032139577594123047, 500, 1500, "GET /api/orders/my-orders"], "isController": false}, {"data": [0.2548165345071909, 500, 1500, "GET /api/products/:id"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 152985, 118672, 77.57100369317253, 140.70116024446685, 0, 863, 102.0, 216.0, 285.0, 499.0, 640.5173207841036, 1166.778027048548, 38.50680884597188], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["POST /api/apply-coupon", 6583, 4918, 74.70758013063953, 145.3208263709557, 1, 861, 172.0, 215.60000000000036, 249.0, 449.15999999999985, 27.76266568824673, 50.67216372218146, 2.0361906977884336], "isController": false}, {"data": ["POST /api/login", 500, 497, 99.4, 12.600000000000005, 1, 185, 3.0, 26.900000000000034, 70.89999999999998, 174.99, 5.601613264620211, 4.654568640768541, 1.1283202687373963], "isController": false}, {"data": ["POST /api/checkout", 6557, 6535, 99.66448070764069, 138.30440750343138, 0, 787, 170.0, 210.0, 226.0, 370.4200000000001, 27.704541229359968, 49.725428136724894, 2.1652631458724163], "isController": false}, {"data": ["POST /api/cart", 6603, 6581, 99.66681811297894, 137.90049977283064, 0, 793, 168.0, 210.0, 228.0, 367.9200000000001, 27.811473338387668, 49.89820172979319, 2.079730145943897], "isController": false}, {"data": ["GET /api/products?search=", 93041, 68990, 74.15010586730581, 141.1343493728568, 0, 863, 151.0, 308.90000000000146, 389.9500000000007, 760.0, 390.3168563553758, 713.6233879322008, 22.69090632774056], "isController": false}, {"data": ["GET /api/orders/my-orders", 6534, 6513, 99.67860422405877, 139.82736455463697, 0, 812, 171.0, 211.0, 230.0, 370.0, 27.642751075630464, 49.99553555847115, 1.5770145992774134], "isController": false}, {"data": ["GET /api/products/:id", 33167, 24638, 74.28468055597432, 141.7037416709378, 1, 863, 177.0, 230.0, 271.0, 484.0, 139.32553118200073, 255.01683375935713, 7.669560399111126], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 111203, 93.70618174464069, 72.6888257018662], "isController": false}, {"data": ["403/Forbidden", 4995, 4.20908049076446, 3.265025982939504], "isController": false}, {"data": ["401/Unauthorized", 362, 0.30504247000134826, 0.23662450567049056], "isController": false}, {"data": ["Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 2112, 1.7796952945935014, 1.3805275026963428], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 152985, 118672, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 111203, "403/Forbidden", 4995, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 2112, "401/Unauthorized", 362, "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["POST /api/apply-coupon", 6583, 4918, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 4841, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 77, "", "", "", "", "", ""], "isController": false}, {"data": ["POST /api/login", 500, 497, "401/Unauthorized", 362, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 135, "", "", "", "", "", ""], "isController": false}, {"data": ["POST /api/checkout", 6557, 6535, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 4758, "403/Forbidden", 1657, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 120, "", "", "", ""], "isController": false}, {"data": ["POST /api/cart", 6603, 6581, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 4827, "403/Forbidden", 1666, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 88, "", "", "", ""], "isController": false}, {"data": ["GET /api/products?search=", 93041, 68990, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 67706, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 1284, "", "", "", "", "", ""], "isController": false}, {"data": ["GET /api/orders/my-orders", 6534, 6513, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 4755, "403/Forbidden", 1672, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 86, "", "", "", ""], "isController": false}, {"data": ["GET /api/products/:id", 33167, 24638, "Non HTTP response code: java.net.BindException/Non HTTP response message: Address already in use: getsockopt", 24181, "Non HTTP response code: org.apache.http.conn.HttpHostConnectException/Non HTTP response message: Connect to localhost:3000 [localhost/127.0.0.1, localhost/0:0:0:0:0:0:0:1] failed: Connection refused: getsockopt", 457, "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
