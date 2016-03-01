// Login
function get_request_token(results) {
    if (results) {
        User.setKey('request_token', results['code']);
        pageStack.push(Qt.resolvedUrl("../ui/Login.qml"));
    } else {
        var url = 'https://getpocket.com/v3/oauth/request';
        var data = "consumer_key="+consumer_key+"&redirect_uri=https://api.github.com/zen";

        request(url, data, get_request_token);
    }
}
function get_access_token(results) {
    if (results) {
        if (results['access_token']) {
            User.setKey('access_token', results['access_token']);
            User.setKey('username', results['username']);

            mainView.home(true)
        }
    } else {
        var url = 'https://getpocket.com/v3/oauth/authorize';
        var data = "consumer_key="+consumer_key+"&code="+User.getKey('request_token');

        request(url, data, get_access_token);
    }
}
function logout() {
    User.setKey('access_token', '');
    User.setKey('request_token', '');
    User.setKey('username', '');
    home()
}

// List from pocket api
function get_list() {
    finished = false

    var access_token = User.getKey('access_token');
    var url = 'https://getpocket.com/v3/get';
    var data = "state=all&sort=oldest&detailType=complete&consumer_key="+consumer_key+"&access_token="+access_token;

    request(url, data, list_got);
}
function list_got(results) {
    var entriesData = []
    for (var k in results['list']) {
           entriesData.push(results['list'][k]);
    }

    downloaded = 0
    totaldownloads = objectLength(results['list'])
    PopupUtils.open(downloadDialog)

    var db = LocalDb.init();

    download_loop(entriesData, 0, db, results);
}

function download_done(results) {
    downloaded = 0

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("SELECT item_id FROM Entries");
        for(var i = 0; i < rs.rows.length; i++) {
            var item_id = rs.rows.item(i).item_id;
            if (!results['list'].hasOwnProperty(item_id)) {
                var rsd = tx.executeSql("DELETE FROM Entries WHERE item_id = ?", item_id);
            }
        }
    });

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("SELECT item_id FROM Articles");
        for(var i = 0; i < rs.rows.length; i++) {
            var item_id = rs.rows.item(i).item_id;
            if (!results['list'].hasOwnProperty(item_id)) {
                var rsed = tx.executeSql("DELETE FROM Articles WHERE item_id = ?", item_id);
            }
        }
    });

    if (objectLength(results['list']) > 0) {
        empty = false

        myListPage.home()
        favListPage.home()
        archiveListPage.home()
    }

    finished = true
}

function download_loop(data, i, db, results) {
    downloaded++

    if (!data[i]) {
        console.log("[LOG] Finished")
        downloaded = totaldownloads
        download_done(results)
        return false;
    }

    db.transaction(function(tx) {
        var res = tx.executeSql("SELECT item_id, time_updated FROM Entries WHERE item_id = ?", data[i]['item_id'])
        // The entry not found
        if (res.rows.length === 0) {
            var image = (data[i]['has_image'] == '1' && data[i]['image']) ? JSON.stringify(data[i]['image']) : '{}';
            var res2 = tx.executeSql("INSERT INTO Entries(item_id, resolved_id, given_url, resolved_url, given_title, resolved_title, sortid, is_article, has_image, has_video, favorite, status, excerpt, word_count, tags, authors, images, videos, image, is_index, time_added, time_updated) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [data[i]['item_id'], data[i]['resolved_id'], data[i]['given_url'], data[i]['resolved_url'], data[i]['given_title'], data[i]['resolved_title'], data[i]['sort_id'], data[i]['is_article'], data[i]['has_image'], data[i]['has_video'], data[i]['favorite'], data[i]['status'], data[i]['excerpt'], data[i]['word_count'], JSON.stringify(data[i]['tags']), JSON.stringify(data[i]['authors']), JSON.stringify(data[i]['images']), JSON.stringify(data[i]['videos']), image, data[i]['is_index'], data[i]['time_added'], data[i]['time_updated']])
            if (User.getKey('auto_download_articles') == 'true') {
                get_article(data[i]['item_id'], data[i]['resolved_url'], true, i, data, db, results);
            } else {
                if (++i < data.length) {
                    download_loop(data, i, db, results);
                } else {
                    downloaded = totaldownloads
                    download_done(results)
                }
            }
        // The entry found
        } else {
            if (res.rows.item(0).time_updated != data[i]['time_updated']) {
                var image = (data[i]['has_image'] == '1' && data[i]['image']) ? JSON.stringify(data[i]['image']) : '{}';
                res2 = tx.executeSql("UPDATE Entries SET resolved_id = ?, given_url = ?, resolved_url = ?, given_title = ?, resolved_title = ?, sortid = ?, is_article = ?, has_image = ?, has_video = ?, favorite = ?, status = ?, excerpt = ?, word_count = ?, tags = ?, authors = ?, images = ?, videos = ?, image = ?, is_index = ?, time_added = ?, time_updated = ? WHERE item_id = ?", [data[i]['resolved_id'], data[i]['given_url'], data[i]['resolved_url'], data[i]['given_title'], data[i]['resolved_title'], data[i]['sort_id'], data[i]['is_article'], data[i]['has_image'], data[i]['has_video'], data[i]['favorite'], data[i]['status'], data[i]['excerpt'], data[i]['word_count'], JSON.stringify(data[i]['tags']), JSON.stringify(data[i]['authors']), JSON.stringify(data[i]['images']), JSON.stringify(data[i]['videos']), image, data[i]['is_index'], data[i]['time_added'], data[i]['time_updated'], data[i]['item_id']])
                if (User.getKey('auto_download_articles') == 'true') {
                    get_article(data[i]['item_id'], data[i]['resolved_url'], true, i, data, db, results);
                } else {
                    if (++i < data.length) {
                        download_loop(data, i, db, results);
                    } else {
                        downloaded = totaldownloads
                        download_done(results)
                    }
                }
            } else {
                if (++i < data.length) {
                    download_loop(data, i, db, results);
                } else {
                    console.log("[LOG] Finished")
                    downloaded = totaldownloads
                    download_done(results)
                }
            }
        }
    });
}

function get_article(item_id, resolved_url, lcallback, li, ldata, ldb, lreslist, parse, refresh) {
    var access_token = User.getKey('access_token');
    var data = "consumer_key="+consumer_key+"&url="+encodeURIComponent(resolved_url)+"&refresh=1&images=1&videos=1&output=json";

    var xhr = new XMLHttpRequest;
    xhr.open("POST", "http://text.getpocket.com/v3/text");

    xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded; charset=UTF8");
    xhr.setRequestHeader("X-Accept", "application/json");

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            var results = JSON.parse(xhr.responseText);

            var db = LocalDb.init();
            db.transaction(function(tx) {
                var rse = tx.executeSql("SELECT item_id FROM Articles WHERE item_id = ?", item_id);
                if (rse.rows.length === 0) {
                    tx.executeSql("INSERT INTO Articles(item_id, resolved_url, title, host, article, datePublished) VALUES(?, ?, ?, ?, ?, ?)", [item_id, results['resolvedUrl'], results['title'], results['host'], results['article'], results['datePublished']]);
                    if (lcallback) {
                        if (++li < ldata.length) {
                            download_loop(ldata, li, ldb, lreslist);
                        } else {
                            console.log("[LOG] Finished")
                            downloaded = totaldownloads
                            download_done(lreslist);
                        }
                    }
                } else {
                    if (refresh == true) {
                        tx.executeSql("UPDATE Articles SET resolved_url = ?, title = ?, host = ?, article = ?, datePublished = ? WHERE item_id = ?", [results['resolvedUrl'], results['title'], results['host'], results['article'], results['datePublished'], item_id]);
                        if (lcallback) {
                            if (++li < ldata.length) {
                                download_loop(ldata, li, ldb, lreslist);
                            } else {
                                downloaded = totaldownloads
                                download_done(lreslist);
                            }
                        }
                    } else {
                        if (lcallback) {
                            if (++li < ldata.length) {
                                download_loop(ldata, li, ldb, lreslist);
                            } else {
                                downloaded = totaldownloads
                                download_done(lreslist);
                            }
                        }
                    }
                }
            });

            if (parse == true) {
                parseArticleView(resolved_url, item_id);
            }
        }
    }

    xhr.send(data);
}

function my_list(is_article, is_image, is_video) {
    finished = false

    var db = LocalDb.init();
    db.transaction(function(tx) {
        if (is_article != 0) {
            var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE is_article = ? AND status = ? ORDER BY time_added DESC", ["1", "0"]);
        } else if (is_image != 0) {
            var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE has_image = ? AND status = ? ORDER BY time_added DESC", ["2", "0"]);
        } else if (is_video != 0) {
            var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE has_video = ? AND status = ? ORDER BY time_added DESC", ["2", "0"]);
        } else {
            var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE status = ? ORDER BY time_added DESC", "0");
        }

        if (rs.rows.length == 0) {
            if (is_article == 0 && is_image == 0 && is_video == 0) {
                empty = true
                get_list()
            }
        } else {
            homeModel.clear()
            for(var i = 0; i < rs.rows.length; i++) {
                var item_id = rs.rows.item(i).item_id;
                var given_title = rs.rows.item(i).given_title;
                var resolved_title = rs.rows.item(i).resolved_title ? rs.rows.item(i).resolved_title : (rs.rows.item(i).given_title ? rs.rows.item(i).given_title : rs.rows.item(i).resolved_url)
                var resolved_url = rs.rows.item(i).resolved_url;
                var sort_id = rs.rows.item(i).sortid;
                var only_domain = extractDomain(rs.rows.item(i).resolved_url);
                var favorite = rs.rows.item(i).favorite;
                var has_video = rs.rows.item(i).has_video;
                var image_obj = JSON.parse(rs.rows.item(i).image);
                if (image_obj.hasOwnProperty('src')) {
                    var image = image_obj.src
                } else {
                    if (objectLength(JSON.parse(rs.rows.item(i).images)) > 0) {
                        var images = JSON.parse(rs.rows.item(i).images);
                        var image = images['1'] ? images['1']['src'] : '';
                    } else {
                        var image = '';
                    }
                }

                homeModel.append({"item_id":item_id, "given_title":given_title, "resolved_title":resolved_title, "resolved_url":resolved_url, "sort_id":sort_id, "only_domain":only_domain, "image":image, "favorite":favorite, "has_video":has_video});

                finished = true
            }
        }
    });
}

function my_favs_list() {
    finished = false
    empty = false

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE favorite = ? AND status = ? ORDER BY time_added DESC", ["1", "0"]);

        if (rs.rows.length == 0) {
            empty = true;
            finished = true;

            favsModel.clear();
        } else {
            favsModel.clear();

            for(var i = 0; i < rs.rows.length; i++) {
                var item_id = rs.rows.item(i).item_id;
                var given_title = rs.rows.item(i).given_title;
                var resolved_title = rs.rows.item(i).resolved_title ? rs.rows.item(i).resolved_title : (rs.rows.item(i).given_title ? rs.rows.item(i).given_title : rs.rows.item(i).resolved_url)
                var resolved_url = rs.rows.item(i).resolved_url;
                var sort_id = rs.rows.item(i).sortid;
                var only_domain = extractDomain(rs.rows.item(i).resolved_url);
                var favorite = rs.rows.item(i).favorite;
                var has_video = rs.rows.item(i).has_video;
                var image_obj = JSON.parse(rs.rows.item(i).image);
                if (image_obj.hasOwnProperty('src')) {
                    var image = image_obj.src
                } else {
                    if (objectLength(JSON.parse(rs.rows.item(i).images)) > 0) {
                        var images = JSON.parse(rs.rows.item(i).images);
                        var image = images['1'] ? images['1']['src'] : '';
                    } else {
                        var image = '';
                    }
                }

                favsModel.append({"item_id":item_id, "given_title":given_title, "resolved_title":resolved_title, "resolved_url":resolved_url, "sort_id":sort_id, "only_domain":only_domain, "image":image, "favorite":favorite, "has_video":has_video});

                finished = true
            }
        }
    });
}

function my_archive_list() {
    finished = false
    empty = false

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE status = ? ORDER BY time_added DESC", "1");

        if (rs.rows.length == 0) {
            empty = true
            finished = true
            //get_list()
        } else {
            archiveModel.clear()
            for(var i = 0; i < rs.rows.length; i++) {
                var item_id = rs.rows.item(i).item_id;
                var given_title = rs.rows.item(i).given_title;
                var resolved_title = rs.rows.item(i).resolved_title ? rs.rows.item(i).resolved_title : (rs.rows.item(i).given_title ? rs.rows.item(i).given_title : rs.rows.item(i).resolved_url)
                var resolved_url = rs.rows.item(i).resolved_url;
                var sort_id = rs.rows.item(i).sortid;
                var only_domain = extractDomain(rs.rows.item(i).resolved_url);
                var favorite = rs.rows.item(i).favorite;
                var has_video = rs.rows.item(i).has_video;
                var image_obj = JSON.parse(rs.rows.item(i).image);
                if (image_obj.hasOwnProperty('src')) {
                    var image = image_obj.src
                } else {
                    if (objectLength(JSON.parse(rs.rows.item(i).images)) > 0) {
                        var images = JSON.parse(rs.rows.item(i).images);
                        var image = images['1'] ? images['1']['src'] : '';
                    } else {
                        var image = '';
                    }
                }

                archiveModel.append({"item_id":item_id, "given_title":given_title, "resolved_title":resolved_title, "resolved_url":resolved_url, "sort_id":sort_id, "only_domain":only_domain, "image":image, "favorite":favorite, "has_video":has_video});

                finished = true
            }
        }
    });
}

function search_offline(query) {
    finished = false
    empty = false

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var lq = '%' + query + '%';
        var rs = tx.executeSql("SELECT item_id, given_title, resolved_title, given_url, resolved_url, sortid, favorite, has_video, has_image, image, images, is_article, status, time_added FROM Entries WHERE given_title LIKE ? OR resolved_title LIKE ? OR given_url LIKE ? OR resolved_url LIKE ? ORDER BY time_added DESC", [lq, lq, lq, lq]);

        if (rs.rows.length == 0) {
            // Not found
            searchModel.clear()
            empty = true
            finished = true
        } else {
            searchModel.clear()
            for(var i = 0; i < rs.rows.length; i++) {
                var item_id = rs.rows.item(i).item_id;
                var given_title = rs.rows.item(i).given_title;
                var resolved_title = rs.rows.item(i).resolved_title ? rs.rows.item(i).resolved_title : (rs.rows.item(i).given_title ? rs.rows.item(i).given_title : rs.rows.item(i).resolved_url)
                var resolved_url = rs.rows.item(i).resolved_url;
                var sort_id = rs.rows.item(i).sortid;
                var only_domain = extractDomain(rs.rows.item(i).resolved_url);
                var favorite = rs.rows.item(i).favorite;
                var has_video = rs.rows.item(i).has_video;
                var image_obj = JSON.parse(rs.rows.item(i).image);
                if (image_obj.hasOwnProperty('src')) {
                    var image = image_obj.src
                } else {
                    if (objectLength(JSON.parse(rs.rows.item(i).images)) > 0) {
                        var images = JSON.parse(rs.rows.item(i).images);
                        var image = images['1'] ? images['1']['src'] : '';
                    } else {
                        var image = '';
                    }
                }

                searchModel.append({"item_id":item_id, "given_title":given_title, "resolved_title":resolved_title, "resolved_url":resolved_url, "sort_id":sort_id, "only_domain":only_domain, "image":image, "favorite":favorite, "has_video":has_video});

                finished = true
            }
        }
    });
}

function clear_list() {
    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("DELETE FROM Entries");
        //homeModel.clear();
        var rse = tx.executeSql("DELETE FROM Articles");
    });
}

function delete_item(item_id) {
    mod_item(item_id, 'delete');
    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("DELETE FROM Entries WHERE item_id = ?", item_id);
        var rse = tx.executeSql("DELETE FROM Articles WHERE item_id = ?", item_id);
    });
}

function archive_item(item_id, val) {
    if (val == '1') {
        mod_item(item_id, 'archive');
    } else {
        mod_item(item_id, 'readd');
    }
    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("UPDATE Entries SET status = ? WHERE item_id = ?", [val, item_id]);
    });
}

function add_item(item_url, item_title) {
    finished = false

    var access_token = User.getKey('access_token');
    var url = 'https://getpocket.com/v3/add';
    var data = "url="+item_url+"&consumer_key="+consumer_key+"&access_token="+access_token;

    request(url, data, item_added);
}

function item_added(results) {
    if (results['item']['item_id']) {
        myListPage.get_list()
    }
}

function fav_item(item_id, val) {
    if (val == '1') {
        mod_item(item_id, 'favorite');
    } else {
        mod_item(item_id, 'unfavorite');
    }
    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("UPDATE Entries SET favorite = ? WHERE item_id = ?", [val, item_id]);
    });
}

function mod_item(item_id, action) {
    var access_token = User.getKey('access_token');
    var url = 'https://getpocket.com/v3/send';
    var actions = '%5B%7B%22action%22%3A%22'+action+'%22%2C%22item_id%22%3A'+item_id+'%7D%5D';

    var data = "actions="+actions+"&consumer_key="+consumer_key+"&access_token="+access_token;

    request(url, data, item_moded);
}

function item_moded(results) {
    //console.log(JSON.stringify(results));
}

function extractDomain(url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (typeof(url) === "undefined") {
        return '';
    }
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

function objectLength(obj) {
  var result = 0;
  for(var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      result++;
    }
  }
  return result;
}

// Article View
function parseArticleView(url, item_id, acc_article) {
    articleBody.loadHtml('');
    articleView.entry_url = '';
    articleView.entry_id = '';
    articleView.entry_title = ' ';

    var db = LocalDb.init();
    db.transaction(function(tx) {
        var rs = tx.executeSql("SELECT * FROM Articles WHERE item_id = ?", item_id);
        var rse = tx.executeSql("SELECT word_count, item_id FROM Entries WHERE item_id = ?", item_id);

        if (rs.rows.length == 0) {
            get_article(item_id, url, false, 0, false, false, false, true);
        } else {
            var result = rs.rows.item(0);

            if (acc_article != true && User.getKey('open_best_view') == 'true' && rse.rows.item(0).word_count == '0') {
                // Properties
                articleView.entry_url = url;
                articleView.entry_id = item_id;
                articleView.entry_title = result.title != '' ? result.title : ' ';
                articleView.view = 'web';
                articleBody.url = url;
                return false;
            }

            // Date
            //var date = new Date(result.datePublished);
            //var newdate = date.getFullYear() + " " + (date.getMonth()+1) + " " + date.getDay();
            var newdate = result.datePublished ? result.datePublished.replace('00:00:00', '') : '';

            // Properties
            articleView.entry_url = url;
            articleView.entry_id = item_id;
            articleView.entry_title = result.title != '' ? result.title : ' ';
            articleView.view = 'article';

            // Style
            var fSize = User.getKey("fontSize") ? FontUtils.sizeToPixels(User.getKey("fontSize")) : FontUtils.sizeToPixels('small');
            var bColor = currentTheme.backgroundColor
            var fColor = currentTheme.baseFontColor
            var font = User.getKey("font") ? User.getKey("font") : "Ubuntu";
            var text_align = User.getKey("justified_text") == 'true' ? "justify" : "initial";

            articleBody.loadHtml(
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<meta charset="utf-8">' +
                '<meta name="viewport" content="width=' + articleBody.width + '">' +
                '<style>' +
                'body {' +
                'background-color: ' + bColor + ';' +
                'color: ' + fColor + ';' +
                'padding: 0px ' + units.gu(1.5) + 'px;' +
                'font-family: ' + font + ';' +
                'font-weight: 300;' +
                'font-size: ' + fSize + 'px;' +
                'text-align: ' + text_align +
                '}' +
                'code, pre { white-space: pre-wrap; word-wrap: break-word; }' +
                'img { display: block; margin: auto; max-width: 100%; }' +
                'a { text-decoration: none; color: #00C0C0; }' +
                'span.upockit { font-size: ' + FontUtils.sizeToPixels('x-small') + 'px; color: ' + fColor + '; }' +
                'h2.upockit { font-size: ' + FontUtils.sizeToPixels('x-large') + '; font-weight: 600; padding-bottom: 12px; margin-bottom: 8px; border-bottom: 1px solid ' + fColor + '; text-align: left; }' +
                '</style>' +
                '</head>' +
                '<body>' +
                '<h2 class="upockit">' + result.title + '</h2>' +
                '<span class="upockit">' + result.host + '</span><br/>' +
                '<span class="upockit">' + newdate + '</span><br/><br/>' +
                result.article +
                '</body>' +
                '</html>'
            );
        }
    });
}

function request(url, params, callback) {
    var xhr = new XMLHttpRequest;
    xhr.open("POST", url);

    var data = params;

    xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded; charset=UTF8");
    xhr.setRequestHeader("X-Accept", "application/json");

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.responseText == "403 Forbidden") {
                console.log(xhr.getResponseHeader('X-Limit-User-Reset'))
                console.log(xhr.responseText)
                finished = true
                return false;
            }

            var results = JSON.parse(xhr.responseText);
            callback(results);
        }
    }

    xhr.send(data);
}
