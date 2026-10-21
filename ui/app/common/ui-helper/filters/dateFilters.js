'use strict';

angular.module('bahmni.common.uiHelper').service('ethiopianConvert', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    this.toEthiopian = function (date, format) {
        var ethDate = "";
        if (date == null) return ethDate;
        var dateRepresentation = isNaN(Number(date)) ? date : Number(date);
        if (format) {
            if (moment(dateRepresentation, format).isValid()) {
                var jsDate = moment(dateRepresentation, format).toDate();
                var string = (jsDate.getMonth() + 1) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
                ethDate = " (" + ethiopianGregorianService.gregToEthMonthName(string) + ")";
            }
        }
        else {
            if (moment(dateRepresentation).isValid()) {
                var jsDate = moment(dateRepresentation).toDate();
                var string = (jsDate.getMonth() + 1) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
                ethDate = " (" + ethiopianGregorianService.gregToEthMonthName(string) + ")";
            }
        }
        return ethDate;
    };
    this.toEthiopianWithDays = function (date) {
        var ethDate = "";
        if (date == null) return ethDate;
        var dateRep = ["DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "MM-DD-YYYY"];
        var daysEth = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሓሙስ', 'ዓርብ', 'ቅዳሜ'];
        var dateRepresentation = isNaN(Number(date)) ? date : Number(date);
        if (moment(dateRepresentation).isValid() || moment(dateRepresentation, dateRep).isValid()) {
            var jsDate = moment(dateRepresentation).isValid() ? moment(dateRepresentation).toDate() : moment(dateRepresentation, dateRep).toDate();
            var string = (jsDate.getMonth()) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
            ethDate = daysEth[jsDate.getDay()] + ", " + ethiopianGregorianService.gregToEthMonthName(string);
        }
        return ethDate;
    };
}]).filter('days', function () {
    return function (startDate, endDate) {
        return Bahmni.Common.Util.DateUtil.diffInDays(startDate, endDate);
    };
}).filter('bahmniDateTime', function () {
    return function (date) {
        let processedDate = date; // Create a copy
        if (Array.isArray(date)) {
            processedDate = [...date]; // Create a shallow copy to avoid modifying the original
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.formatDateWithTime(processedDate);
    };
}).filter('bahmniDate', function () {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.formatDateWithoutTime(processedDate);
    };
}).filter('bahmniTime', function () {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.formatTime(processedDate);
    };
}).filter('bahmniDateInStrictMode', function () {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.formatDateInStrictMode(processedDate);
    };
}).filter('bahmniDateTimeWithFormat', function () {
    return function (date, format) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.getDateTimeInSpecifiedFormat(processedDate, format);
    };
}).filter('addDays', function () {
    return function (date, numberOfDays) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.addDays(processedDate, numberOfDays);
    };
}).filter('bahmniDateTime', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        const formatted = Bahmni.Common.Util.DateUtil.formatDateWithTime(processedDate);
        return formatted + ethiopianConvert.toEthiopian(processedDate);
    };
}]).filter('bahmniDate', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        const formatted = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(processedDate);
        return formatted + ethiopianConvert.toEthiopian(processedDate);
    };
}]).filter('bahmniDateWithFormat', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date, format) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        const parsed = Bahmni.Common.Util.DateUtil.parseUsingFormat(processedDate, format);
        const formatted = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(parsed);
        return formatted + ethiopianConvert.toEthiopian(processedDate, format);
    };
}]).filter('bahmniTime', function () {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        return Bahmni.Common.Util.DateUtil.formatTime(processedDate);
    };
}).filter('bahmniDateInStrictMode', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        let processedDate = date;
        if (Array.isArray(date)) {
            processedDate = [...date];
            processedDate[1] -= 1;
        }
        const formatted = Bahmni.Common.Util.DateUtil.formatDateInStrictMode(processedDate);
        return formatted + ethiopianConvert.toEthiopian(processedDate);
    };
}]).filter('bahmniCalDate', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        return ethiopianConvert.toEthiopianWithDays(date);
    };
}]);
