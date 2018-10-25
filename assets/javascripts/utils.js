var YTK = YTK || {};

YTK.utils = (function () {
    var showDiv = function ($div) {
        $div.removeClass('hidden');
    },
    hideDiv = function ($div) {
        $div.addClass('hidden');
    },
    clearDiv = function ($div) {
        $div.empty();
    };

    return {
        showDiv: showDiv,
        hideDiv: hideDiv,
        clearDiv: clearDiv
    }
})();