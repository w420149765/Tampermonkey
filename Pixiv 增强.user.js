// ==UserScript==
// @name        Pixiv Plus
// @name:zh-CN  Pixiv 增强
// @name:zh-TW  Pixiv 增強
// @namespace   https://github.com/Ahaochan/Tampermonkey
// @version     0.3.1
// @description Focus on the immersive experience, 1. Block ads, hide the popular image mask layer of the search page, and directly access the popular images. 2. Search by means of users, and display high-quality works first. 3. Additional search pid and uid functions 4. Single The picture is replaced with the original image format. Append download button, download gif, gif frame compression package, multi-image 5. Display artist id, artist background in the artist page and the work page 6. Automatically load comments 7. On the artist page dynamic The picture in the tag marks the type of work. Github: https://github.com/Ahaochan/Tampermonkey, welcome to star and fork.
// @description:zh-CN 专注沉浸式体验, 1. 屏蔽广告, 隐藏搜索页的热门图片遮罩层, 直接访问热门图片 2. 使用users入り的方式进行搜索, 优先显示高质量作品 3. 追加搜索pid和uid功能 4. 单张图片替换为原图格式. 追加下载按钮, 下载gif图、gif的帧压缩包、多图 5. 在画师页面和作品页面显示画师id、画师背景图 6. 自动加载评论 7. 对画师页动态中的图片标记作品类型。github:https://github.com/Ahaochan/Tampermonkey，欢迎star和fork。
// @description:zh-TW 專注沉浸式體驗, 1. 屏蔽廣告, 隱藏搜索頁的熱門圖片遮罩層, 直接訪問熱門圖片2. 使用users入り的方式進行搜索, 優先顯示高質量作品3. 追加搜索pid和uid功能4. 單張圖片替換為原圖格式. 追加下載按鈕, 下載gif圖、gif的幀壓縮包、多圖5. 在畫師頁面和作品頁面顯示畫師id、畫師背景圖6. 自動加載評論7. 對畫師頁動態中的圖片標記作品類型。 github:https://github.com/Ahaochan/Tampermonkey，歡迎star和fork。
// @author      Ahaochan
// @include     http*://www.pixiv.net*
// @match       http://www.pixiv.net/
// @connect     i.pximg.net
// @supportURL  https://github.com/Ahaochan/Tampermonkey
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant       GM.setClipboard
// @require     https://code.jquery.com/jquery-2.2.4.min.js
// @require     https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require     https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
// @require     https://greasyfork.org/scripts/2963-gif-js/code/gifjs.js?version=8596
// @run-at      document-end
// @noframes
// ==/UserScript==

jQuery(function ($) {
    'use strict';
    // 加载依赖

    // ============================ 全局参数 ====================================
    let lang = document.documentElement.getAttribute('lang') || 'en',
        globalInitData = unsafeWindow.globalInitData,
        illustJson = {};
    let illust = function () {
        // 1. 判断是否已有作品id(兼容按左右方向键翻页的情况)
        let preIllustId = $('body').attr('ahao_illust_id');
        let urlIllustId = new URL(location.href).searchParams.get("illust_id");
        // 2. 如果illust_id没变, 则不更新json
        if (parseInt(preIllustId) === parseInt(urlIllustId)) {
            return illustJson;
        }
        // 3. 如果illust_id变化, 则持久化illust_id, 且同步更新json
        $('body').attr('ahao_illust_id', urlIllustId);
        $.ajax({url: '/ajax/illust/' + urlIllustId, dataType: 'json', async: false, success: response => illustJson = response.body});
        return illustJson;
    };
    let uid = illust().userId || (pixiv && pixiv.context.userId) || (globalInitData && Object.keys(globalInitData.preload.user)[0]) || 'unknown';
    let mimeType = suffix => {
        let lib = {png: "image/png", jpg: "image/jpeg", gif: "image/gif"};
        return lib[suffix] || 'mimeType[' + suffix + '] not found';
    };
    let executeMutationObserver = function (option) {
        var options = $.extend({
            type: 'childList',
            attributeName: [],
            isValid: () => false,
            execute: addedNodes => {}
        }, option);

        // 2.1. MutationObserver 处理
        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var mutationObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (options.type !== mutation.type) {
                    return;
                }
                if (options.type === 'attributes' && options.attributeName && options.attributeName.indexOf(mutation.attributeName) < 0) {
                    return;
                }
                if (mutation.target && typeof mutation.target !== 'object') {
                    return;
                }
                var $parent = $(mutation.target).parent();
                if (!options.isValid($parent)) {
                    return;
                }
                options.execute($parent);

            });
        });
        mutationObserver.observe(document.getElementsByTagName('body')[0], {
            childList: true,
            subtree: true,
            attributes: true
        });

        // 2.2. 定时处理, 避免 MutationObserver 来不及加载的情况, 10秒后交由 MutationObserver 接管
        var intervalId = setInterval(function () {
            var $body = $('body');
            if (!options.isValid($body)) {
                return;
            }
            options.execute($body);
        }, 1000);
        setTimeout(function () {
            window.clearInterval(intervalId);
        }, 10000);
    };

    // ============================ i18n 国际化 ===============================
    let i18nLib = {
        ja: {
            favorites: 'users入り',
        },
        en: {
            favorites: 'favorites',
            illegal: 'illegal',
            download: 'download',
            download_wait: 'please wait download completed',
            copy_to_clipboard: 'copy to Clipboard',
            background: 'background',
            background_not_found: 'no-background',
            loginWarning: 'Pixiv Plus Script Warning! Please login to Pixiv for a better experience! Failure to login may result in unpredictable bugs!',
            illust_type_single: '[single pic]',
            illust_type_multiple: '[multiple pic]',
            illust_type_gif: '[gif pic]',
        },
        ko: {},
        zh: {
            favorites: '收藏人数',
            illegal: '不合法',
            download: '下载',
            download_wait: '请等待下载完成',
            copy_to_clipboard: '已复制到剪贴板',
            background: '背景图',
            background_not_found: '无背景图',
            loginWarning: 'Pixiv增强 脚本警告! 请登录Pixiv获得更好的体验! 未登录可能产生不可预料的bug!',
            illust_type_single: '[单图]',
            illust_type_multiple: '[多图]',
            illust_type_gif: '[gif图]',
        },
        'zh-CN': {},
        'zh-tw': {
            favorites: '收藏人數',
            illegal: '不合法',
            download: '下載',
            download_wait: '請等待下載完成',
            copy_to_clipboard: '已復製到剪貼板',
            background: '背景圖',
            background_not_found: '無背景圖',
            loginWarning: 'Pixiv增強 腳本警告! 請登錄Pixiv獲得更好的體驗! 未登錄可能產生不可預料的bug!',
            illust_type_single: '[單圖]',
            illust_type_multiple: '[多圖]',
            illust_type_gif: '[gif圖]',
        }
    };
    i18nLib['zh-CN'] = $.extend({}, i18nLib.zh);
    // TODO 待翻译
    i18nLib.ja = $.extend({}, i18nLib.en, i18nLib.ja);
    i18nLib.ko = $.extend({}, i18nLib.en, i18nLib.ko);
    let i18n = key => i18nLib[lang][key] || 'i18n[' + lang + '][' + key + '] not found';

    // ============================ url 页面判断 ==============================
    let isArtworkPage = /.+member_illust\.php\?.*illust_id=\d+.*/.test(location.href);

    let isMemberIndexPage = /.+member.php.*id=\d+.*/.test(location.href);
    let isMemberIllustPage = /.+\/member_illust\.php\?id=\d+/.test(location.href);
    let isMemberBookmarkPage = /.+\/bookmark\.php\?id=\d+/.test(location.href);
    let isMemberFriendPage = /.+\/mypixiv_all\.php\?id=\d+/.test(location.href);
    let isMemberDynamicPage = /.+\/stacc\/.+/.test(location.href);
    let isMemberPage = isMemberIndexPage || isMemberIllustPage || isMemberBookmarkPage || isMemberFriendPage || isMemberDynamicPage;

    // ============================ 反混淆 ====================================
    let confusedLib = {};
    setInterval(function () {
        let webpackJsonp = unsafeWindow.webpackJsonp;
        let filter = webpackJsonp.map(value => value[1]).filter(value => value && !Array.isArray(value) && typeof value === 'object');
        $.each(filter, (index, obj) => {
            for (let key in obj) {
                if (!obj.hasOwnProperty(key)) {
                    continue;
                }
                let tmp = {};
                try { obj[key](tmp); } catch(err) { continue; };
                if(tmp.hasOwnProperty('exports')) {
                    confusedLib = $.extend(confusedLib, tmp.exports);
                }
            }
        });
    }, 1000);
    var confused = function (key) {
        return confusedLib[key] || 'confused[' + key + '] not found';
    };

    // 判断是否登录
    if (dataLayer[0].login === 'no') {
        alert(i18n('loginWarning'));
    }

    // 1. 屏蔽广告, 隐藏搜索页的热门图片遮罩层, 直接访问热门图片
    (function () {
        // 1. 删除静态添加的广告
        $('._premium-lead-tag-search-bar').hide();
        $('.popular-introduction-overlay').hide();// 移除热门图片遮罩层

        // 2. 删除动态添加的广告
        executeMutationObserver({
            type: 'childList',
            isValid: () => true,
            execute: function ($parent) {
                // 2.1. 隐藏广告
                (function () {
                    var adSelector = ['iframe', '._premium-lead-promotion-banner', '.' + confused('alertContainer')];
                    var $ad = $parent.find(adSelector.join(','));
                    if (!$ad.length) {
                        return;
                    }
                    $ad.hide();
                })();

                // 2.2. 移除class
                (function () {
                    var $figure = $parent.find('figure');
                    if (!$figure.length) {
                        return false;
                    }
                    var classSelector = ['.' + confused('blur')];
                    var $class = $parent.find(classSelector.join(','));
                    if (!$class.length) {
                        return;
                    }
                    $class.removeClass(classSelector.map(function (value) { return value.replace('.', ''); }).join(' '));
                })();
            }
        });
    })();

    // 2. 使用users入り的方式进行搜索, 优先显示高质量作品
    (function () {
        var label = i18n('favorites'); // users入り

        // 1. 初始化通用页面UI
        (function () {
            if (isArtworkPage) {
                return;
            }
            console.log("初始化通用页面 按收藏数搜索");
            var icon = $('._discovery-icon').attr('src');
            $('.navigation-menu-right').append(
                '<div class="menu-group">' +
                '    <a class="menu-item js-click-trackable-later">' +
                '           <img class="_howto-icon" src="' + icon + '">' +
                '           <span class="label">' + label + '：</span>' +
                '           <select id="select-ahao-favorites">' +
                '               <option value=""></option>' +
                '               <option value="10000users入り">10000users入り</option>' +
                '               <option value="5000users入り" > 5000users入り</option>' +
                '               <option value="1000users入り" > 1000users入り</option>' +
                '               <option value="500users入り"  >  500users入り</option>' +
                '               <option value="300users入り"  >  300users入り</option>' +
                '               <option value="100users入り"  >  100users入り</option>' +
                '               <option value="50users入り"   >   50users入り</option>' +
                '           </select>' +
                '   </a>' +
                '</div>');
        })();

        // 2. 初始化作品页面UI
        (function () {
            if (!isArtworkPage) {
                return;
            }
            console.log("初始化作品页面 按收藏数搜索");
            executeMutationObserver({
                type: 'childList',
                isValid: function ($parent) {
                    // 1. 判断是否添加完毕
                    if (!!$parent.find('#select-ahao-favorites').length) {
                        return false;
                    }

                    // 2. 判断[发现]节点是否加入dom
                    var $discovery = $parent.find('a[href="/discovery"]');
                    if (!$discovery.length) {
                        return false;
                    }
                    return true;
                },
                execute: function ($parent) {
                    var $discovery = $parent.find('a[href="/discovery"]');
                    // 3. clone [发现]节点, 移除href属性, 避免死循环
                    var $tabGroup = $discovery.closest('div');
                    var $tab = $discovery.closest('ul').clone();
                    $tab.find('a[href="/discovery"]').attr('href', 'javascript:void(0)');

                    // 4. 加入dom中
                    $tabGroup.prepend($tab);
                    $tab.find('a').contents().last()[0].textContent = label;
                    $tab.find('a').after('' +
                        '<select id="select-ahao-favorites">' +
                        '    <option value=""></option>' +
                        '    <option value="10000users入り">10000users入り</option>' +
                        '    <option value="5000users入り" > 5000users入り</option>' +
                        '    <option value="1000users入り" > 1000users入り</option>' +
                        '    <option value="500users入り"  >  500users入り</option>' +
                        '    <option value="300users入り"  >  300users入り</option>' +
                        '    <option value="100users入り"  >  100users入り</option>' +
                        '    <option value="50users入り"   >   50users入り</option>' +
                        '</select>');
                }
            });
        })();

        // 3. 如果已经有搜索字符串, 就在改变选项时直接搜索
        $('body').on('change', '#select-ahao-favorites', function () {
            if (!!$('input[name="word"]').val()) {
                $('form[action="/search.php"]').submit();
            }
        });

        // 4. 在提交搜索前处理搜索关键字
        $('form[action="/search.php"]').submit(function () {
            var $text = $(this).find('input[name="word"]');
            var $favorites = $('#select-ahao-favorites');
            // 3.1. 去除旧的搜索选项
            $text.val((index, val) => val.replace(/\d*users入り/g, ''));
            // 3.2. 去除多余空格
            $text.val((index, val) => val.replace(/\s\s+/g, ' '));
            // 3.3. 添加新的搜索选项
            $text.val((index, val) => val + ' ' + $favorites.val());
        });
    })();

    // 3. 追加搜索pid和uid功能
    (function () {
        // 1. 初始化通用页面UI
        (function () {
            if (isArtworkPage) {
                return;
            }
            console.log("初始化通用页面 搜索UID和PID");
            var initSearch = function (option) {
                var options = $.extend({right: '0px', placeholder: '', url: ''}, option);

                // 1. 初始化表单UI
                var $form = $('<form class="ui-search" ' +
                    '    style="position: static;width: 100px;">' +
                    '<div class="container" style="width:80%;">' +
                    '    <input class="ahao-input" placeholder="' + options.placeholder + '" style="width:80%;"/>' +
                    '</div>' +
                    '<input type="submit" class="submit sprites-search-old" value="">' +
                    '</form>');
                var $div = $('<div class="ahao-search"></div>').css('position', 'absolute')
                    .css('bottom', '44px')
                    .css('height', '30px')
                    .css('right', options.right);
                $div.append($form);
                $('#suggest-container').before($div);

                // 2. 绑定submit事件
                $form.submit(function (e) {
                    e.preventDefault();

                    var $input = $(this).find('.ahao-input');
                    var id = $input.val();
                    // 2.1. ID 必须为纯数字
                    if (!/^[0-9]+$/.test(id)) {
                        var label = options.placeholder + i18n('illegal');
                        alert(label);
                        return;
                    }
                    // 2.2. 新窗口打开url
                    var url = option.url + id;
                    window.open(url);
                    // 2.3. 清空input等待下次输入
                    $input.val('');
                });
            };
            // 1. UID搜索
            initSearch({right: '235px', placeholder: 'UID', url: 'https://www.pixiv.net/member.php?id='});
            // 2. PID搜索
            initSearch({right: '345px', placeholder: 'PID', url: 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id='});
        })();

        // 2. 初始化作品页面UI
        (function () {
            if (!isArtworkPage) {
                return;
            }
            console.log("初始化作品页面 搜索UID和PID");
            executeMutationObserver({
                type: 'childList',
                isValid: function ($parent) {
                    // 1. 判断是否添加完毕
                    if (!!$parent.find('.ahao-search').length) {
                        return false;
                    }

                    // 2. 判断 form 节点是否加入dom
                    var $form = $parent.find('form[action="/search.php"]');
                    if (!$form.length) {
                        return false;
                    }
                    return true;
                },
                execute: function ($parent) {
                    var $form = $parent.find('form[action="/search.php"]');
                    // 3. 使用flex布局包裹
                    var $flexBox = $('<div></div>').css('display', 'flex');
                    $form.wrap($flexBox);
                    $flexBox = $form.closest('div');

                    var initSearch = function (option) {
                        var options = $.extend({
                            placeholder: '',
                            url: ''
                        }, option);

                        // 4. clone form表单
                        var $cloneForm = $form.clone();
                        $cloneForm.attr('action', '').addClass('ahao-search').css('margin-right', '15px').css('width', '126px');
                        $cloneForm.find('input[name="s_mode"]').remove(); // 只保留一个input
                        $cloneForm.find('input:first').attr('placeholder', options.placeholder).attr('name', options.placeholder).css('width', '64px');
                        $flexBox.prepend($cloneForm);

                        // 5. 绑定submit事件
                        $cloneForm.submit(function (e) {
                            e.preventDefault();

                            var $input = $(this).find('input[name="' + options.placeholder + '"]');
                            var id = $input.val();
                            // ID 必须为纯数字
                            if (!/^[0-9]+$/.test(id)) {
                                var label = options.placeholder + i18n('illegal');
                                alert(label);
                                return;
                            }
                            // 新窗口打开url
                            var url = option.url + id;
                            window.open(url);
                            // 清空input等待下次输入
                            $input.val('');
                        });
                    };
                    // 1. UID搜索
                    initSearch({placeholder: 'UID', url: 'https://www.pixiv.net/member.php?id='});
                    // 2. PID搜索
                    initSearch({
                        placeholder: 'PID',
                        url: 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id='
                    });
                }
            });
        })();
    })();

    // 4. 单张图片替换为原图格式. 追加下载按钮, 下载gif图、gif的帧压缩包、多图
    (function () {
        if (!isArtworkPage) {
            return;
        }
        // 1. 初始化 下载按钮, 复制分享按钮并旋转180度
        let initDownloadBtn = function (option) {
            let options = $.extend({$parent: undefined, id: '', text: '', clickFun: ()=>{}}, option);
            let $shareButtonContainer = options.$parent.find('.' + confused('shareButtonContainer'));
            let $downloadButtonContainer = $shareButtonContainer.clone();
            $downloadButtonContainer.addClass('ahao-download-btn')
                .attr('id', options.id)
                .removeClass(confused('shareButtonContainer'))
                .css('margin-right', '10px')
                .css('position', 'relative')
                .append('<p>'+options.text+'</p>');
            $downloadButtonContainer.find('button').css('transform', 'rotate(180deg)')
                .on('click', options.clickFun);
            $shareButtonContainer.after($downloadButtonContainer);
        };

        executeMutationObserver({
            type: 'attributes',
            attributeName: ['src', 'srcset'],
            isValid: function ($parent) {
                // 1. 判断 执行完毕
                var $img = $parent.find('img.' + confused('illust'));
                let isImgExist = !!$img.length;
                let isImgSrcOriginal = /.+original.+/.test($img.attr('src'));
                let isImgSrcsetEmpty = $img.attr('srcset');
                if (!isImgExist || (isImgSrcOriginal && !isImgSrcsetEmpty)) {
                    return false;
                }
                return true;
            },
            execute: function ($parent) {
                // 1. 单图、多图、gif图三种模式
                var moreMode = !!$('a.' + confused('mangaViewLink')).length;
                var gifMode = !!$('button.' + confused('play')).length;
                var singleMode = !moreMode && !gifMode;
                if (!singleMode) {
                    return;
                }
                console.log('下载单图');

                // 2. 替换大图
                var $img = $parent.find('img.' + confused('illust'));
                let url = illust().urls.original;
                $img.attr('src', url).attr('srcset', '');

            }
        });
        executeMutationObserver({
            type: 'childList',
            isValid: function ($parent) {
                // 1. 判断 figure 节点是否加入dom
                var $figure = $parent.find('figure');
                if (!$figure.length) {
                    return false;
                }

                // 2. 判断 执行完毕
                var $sharBtn = $parent.find('.' + confused('shareButtonContainer'));
                if (!$sharBtn.length || !!$parent.find('.ahao-download-btn').length) {
                    return false;
                }
                return true;
            },
            execute: function ($parent) {
                // 1. 单图、多图、gif图三种模式
                var moreMode = !!$('a.' + confused('mangaViewLink')).length;
                var gifMode = !!$('button.' + confused('play')).length;
                var singleMode = !moreMode && !gifMode;
                if (!gifMode) {
                    return;
                }
                console.log('下载gif图');

                // 2. 从 pixiv 官方 api 获取 gif 的数据, 要求 async:false, 否则页面混乱
                $.ajax({url: '/ajax/illust/' + illust().illustId + '/ugoira_meta',
                    dataType: 'json', async: false,
                    success: response => {
                        // 2.1. 初始化 zip 下载按钮
                        initDownloadBtn({
                            $parent: $parent,
                            id: 'ahao-download-zip',
                            text: 'zip',
                            clickFun: () => window.open(response.body.originalSrc)
                        });

                        // 2.2. 初始化 gif 下载按钮
                        // GIF_worker_URL 来自 https://greasyfork.org/scripts/2963-gif-js/code/gifjs.js?version=8596
                        let gifUrl;
                        let gif = new GIF({workers: 2, quality: 10, workerScript: GIF_worker_URL});
                        let gifFrames = [];
                        $.each(response.body.frames, function (index, frame) {
                            let url = illust().urls.original.replace('ugoira0.', 'ugoira'+index+'.');
                            GM.xmlHttpRequest({
                                method: 'GET', url: url,
                                headers: {referer: 'https://www.pixiv.net/'},
                                overrideMimeType: 'text/plain; charset=x-user-defined',
                                onload: function (xhr) {
                                    // 2.1. 转为blob类型
                                    let r = xhr.responseText, data = new Uint8Array(r.length), i = 0;
                                    while (i < r.length) {
                                        data[i] = r.charCodeAt(i);
                                        i++;
                                    }
                                    let suffix = url.split('.').splice(-1);
                                    let blob = new Blob([data], {type: mimeType(suffix)});

                                    // 2.2. 压入gifFrames数组中, 手动同步sync
                                    let img = document.createElement('img');
                                    img.src = URL.createObjectURL(blob);
                                    img.width = illust().width;
                                    img.height = illust().height;
                                    gifFrames[index] = {frame: img, option: {delay: frame.delay}};

                                    let loadFramesLength = Object.keys(gifFrames).length;
                                    // 2.3. 若xhr执行完毕, 则加载gif
                                    if(loadFramesLength >= response.body.frames.length){
                                        $.each(gifFrames, function (index, frame) {
                                            gif.addFrame(frame.frame, frame.option);
                                        });
                                        gif.render();
                                    }
                                }
                            });
                        });
                        gif.on('progress', function (pct) {
                            $('#ahao-download-gif').find('p').text('gif '+parseInt(pct*100)+'%');
                        });
                        gif.on('finished', function(blob) {
                            gifUrl = URL.createObjectURL(blob);

                            let $a = $('<a id="ahao-download-gif" ></a>')
                                .attr('href', gifUrl)
                                .attr('download', illust().illustId+'.gif');
                            $('#ahao-download-gif').find('button').wrap($a);
                        });

                        initDownloadBtn({
                            $parent: $parent,
                            id: 'ahao-download-gif',
                            text: 'gif 0%',
                            clickFun: function () {
                                if (!gifUrl) {
                                    alert('Gif未加载完毕, 请稍等片刻!');
                                    return;
                                }
                                // Adblock 禁止直接打开 blob url, https://github.com/jnordberg/gif.js/issues/71#issuecomment-367260284
                                // window.open(gifUrl);
                            }
                        });
                    }
                });


            }
        });
        executeMutationObserver({
            type: 'childList',
            isValid: function ($parent) {
                // 1. 判断 figure 节点是否加入dom
                var $figure = $parent.find('figure');
                if (!$figure.length) {
                    return false;
                }

                // 2. 判断 执行完毕
                var $sharBtn = $parent.find('.' + confused('shareButtonContainer'));
                if (!$sharBtn.length || !!$parent.find('.ahao-download-btn').length) {
                    return false;
                }
                return true;
            },
            execute: function ($parent) {
                // 1. 单图、多图、gif图三种模式
                var moreMode = !!$('a.' + confused('mangaViewLink')).length;
                var gifMode = !!$('button.' + confused('play')).length;
                var singleMode = !moreMode && !gifMode;
                if (!moreMode) {
                    return;
                }
                console.log('下载多图');

                // 2. 初始化 图片数量, 图片url
                let zip = new JSZip();
                let downloaded = 0;           // 下载完成数量
                let num = illust().pageCount; // 下载目标数量
                let url = illust().urls.original;
                let imgUrls = Array(parseInt(num)).fill()
                    .map((value, index) => url.replace(/_p\d\./, '_p' + index + '.'));

                // 3. 初始化 下载按钮, 复制分享按钮并旋转180度
                initDownloadBtn({
                    $parent: $parent,
                    id: 'ahao-download-gif',
                    text: i18n('download') + '0/' + num,
                    clickFun: function () {
                        // 3.1. 手动sync, 避免下载不完全
                        if (downloaded < num) {
                            alert(i18n('download_wait'));
                            return;
                        }
                        // 3.2. 使用jszip.js和FileSaver.js压缩并下载图片
                        zip.generateAsync({type: 'blob', base64: true})
                            .then(content => saveAs(content, illust().illustId + '.zip'));
                    }
                });

                // 4. 下载图片, https://wiki.greasespot.net/GM.xmlHttpRequest
                $.each(imgUrls, function (index, url) {
                    GM.xmlHttpRequest({
                        method: 'GET', url: url,
                        headers: {referer: 'https://www.pixiv.net/'},
                        overrideMimeType: 'text/plain; charset=x-user-defined',
                        onload: function (xhr) {
                            // 4.1. 转为blob类型
                            let r = xhr.responseText, data = new Uint8Array(r.length), i = 0;
                            while (i < r.length) {
                                data[i] = r.charCodeAt(i);
                                i++;
                            }
                            let suffix = url.split('.').splice(-1);
                            let blob = new Blob([data], {type: mimeType(suffix)});

                            // 4.2. 压缩图片
                            zip.file(illust().illustId + '_' + index + '.' + suffix, blob, {binary: true});

                            // 4.3. 手动sync, 避免下载不完全的情况
                            downloaded++;
                            $('.ahao-download-btn').find('p').html(i18n('download') + '' + downloaded + '/' + num);
                        }
                    });
                });
            }
        });
    })();

    // 5. 在画师页面和作品页面显示画师id、画师背景图
    (function () {
        // 画师页面UI
        (function () {
            if (!isMemberPage) {
                return;
            }

            // 1. 获取用户名的元素
            var $username = $('a.user-name');

            // 2. 显示画师背景图
            var url = $('body').css('background-image').replace('url(', '').replace(')', '').replace(/"/gi, "");
            var $div = $('<div style="text-align: center"></div>');
            if (!!url && url !== 'none') {
                $div.append('<img src="' + url + '" width="10%">' +
                    '<a target="_blank" href="' + url + ' ">' + i18n('background') + '</a>');
            } else {
                $div.append('<span>' + i18n('background_not_found') + '</span>');
            }
            $username.after($div);

            // 3. 显示画师id, 点击自动复制到剪贴板
            var $uid = $('<span>UID: ' + uid + '</span>')
                .on('click', function () {
                    var $this = $(this);
                    $this.text('UID' + i18n('copy_to_clipboard'));
                    GM.setClipboard(uid);
                    setTimeout(function () {
                        $this.text('UID: ' + uid);
                    }, 2000);
                });
            $username.after($uid);
        })();
        // 作品页面UI
        (function () {
            if (!isArtworkPage) {
                return;
            }

            executeMutationObserver({
                type: 'childList',
                isValid: function ($parent) {
                    // 1. 判断 画师名称 节点是否加入dom
                    var $authorName = $parent.find('.' + confused('authorTopRow'));
                    if (!$authorName.length) {
                        return false;
                    }

                    // 2. 判断 执行完毕
                    var $uid = $parent.find('#ahao-uid'), $background = $parent.find('#ahao-background');
                    if (!!$uid.length || !!$background.length) {
                        return false;
                    }
                    return true;
                },
                execute: function ($parent) {
                    console.log("显示画师id和背景图");
                    let $authorTopRow = $parent.find('.' + confused('authorTopRow'));
                    let $authorMeta = $authorTopRow.children('div.' + confused('authorMeta'));

                    // 1. 显示画师背景图
                    var background = globalInitData.preload.user[uid].background;
                    var url = (background && background.url) || '';
                    var $authorSecondRow = $authorTopRow.clone().attr('id', 'ahao-background');
                    $authorSecondRow.children('a').remove();
                    $authorSecondRow.prepend('<img src="' + url + '" width="10%"/>');
                    $authorSecondRow.find('div a').attr('href', !!url ? url : 'javascript:void(0)').attr('target', '_blank')
                        .text(!!url ? i18n('background') : i18n('background_not_found'));
                    $authorTopRow.after($authorSecondRow);

                    // 2. 显示画师id, 点击自动复制到剪贴板
                    var $uid = $authorMeta.clone();
                    $uid.find('a').attr('href', 'javascript:void(0)').attr('id', 'ahao-uid').text('UID: ' + uid);
                    $uid.on('click', function () {
                        var $this = $(this);
                        $this.find('a').text('UID' + i18n('copy_to_clipboard'));
                        GM.setClipboard(uid);
                        setTimeout(function () {
                            $this.find('a').text('UID: ' + uid);
                        }, 2000);
                    });
                    $authorMeta.after($uid);
                }
            });
        })();
    })();

    // 6. 自动加载评论
    (function () {
        if (!isArtworkPage) {
            return;
        }
        executeMutationObserver({
            type: 'childList',
            isValid: function ($parent) {
                // 1. 判断 查看更多评论 节点是否加入dom
                var $showMoreButton = $parent.find('.' + confused('showMoreButton'));
                if (!$showMoreButton.length) {
                    return false;
                }
                return true;
            },
            execute: function ($parent) {
                $parent.find('.' + confused('showMoreButton')).click();
            }
        });
    })();

    // 7. 对画师页动态中的图片标记作品类型
    (function () {
        if(!isMemberDynamicPage) {
            return;
        }

        executeMutationObserver({
            type: 'childList',
            isValid: function ($parent) {
                // 1. 判断 figure 节点是否加入dom
                let $title = $parent.find('.stacc_ref_illust_title');
                if (!$title.length) {
                    return false;
                }
                return true;
            },
            execute: function ($parent) {
                $parent.find('.stacc_ref_illust_title').each(function () {
                    let $a = $(this).find('a');
                    // 1. 已经添加过标记的就不再添加
                    if(!!$a.attr('ahao-illust-id')){
                        return;
                    }
                    // 2. 获取pid, 设置标记避免二次生成
                    let illustId = new URL(location.origin + '/' + $a.attr('href')).searchParams.get('illust_id');
                    $a.attr('ahao-illust-id', illustId);
                    // 3. 调用官方api, 判断作品类型
                    $.ajax({
                        url: '/ajax/illust/' + illustId, dataType: 'json',
                        success: response => {
                            let illustType = parseInt(response.body.illustType);
                            let isMultiPic = parseInt(response.body.pageCount) > 1;
                            switch (illustType) {
                                case 0:
                                case 1:$a.after('<p>' + (isMultiPic ? i18n('illust_type_multiple') : i18n('illust_type_single')) + '</p>');break;
                                case 2:$a.after('<p>'+i18n('illust_type_gif')+'</p>');break;
                            }
                        }
                    });
                })

            }
        });
    })();
});