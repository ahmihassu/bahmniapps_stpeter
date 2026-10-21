'use strict';

angular.module('bahmni.common.ethiopianDateSelector').factory('ethiopianGregorianService', function () {
    // function used to convert from ethiopian date to gregorian date
    var ethToGreg = function (ethdate) {
        if (!ethdate) return null;
        // /////////////////////////////////
        var dmy = ethdate.split("/");
        if (dmy.length == 3) {
            var appdate = jQuery.calendars.instance('ethiopian').newDate(parseInt(dmy[2], 10), parseInt(dmy[1], 10), parseInt(dmy[0], 10));
            var jd = jQuery.calendars.instance('ethiopian').toJD(appdate);
            var appdategc = jQuery.calendars.instance('gregorian').fromJD(jd);
            var appdategcstr = jQuery.calendars.instance('gregorian').formatDate('mm/dd/yyyy', appdategc);

            return appdategcstr;
        }
        else return null;
    };

    // function used to convert from gregorian date to ethiopian date
    var gregToEth = function (gregdate) {
        if (!gregdate) return null;
        var dmy;
        dmy = gregdate.split("-");// first try the - separator
        if (dmy.length != 3) dmy = gregdate.split("/");// then try the / separator
        if (dmy.length == 3) {
            var appdate = jQuery.calendars.instance('gregorian').newDate(parseInt(dmy[2], 10), parseInt(dmy[0], 10), parseInt(dmy[1], 10));
            var jd = jQuery.calendars.instance('gregorian').toJD(appdate);
            var appdateet = jQuery.calendars.instance('ethiopian').fromJD(jd);
            var appdateetstr = jQuery.calendars.instance('ethiopian').formatDate('dd/mm/yyyy', appdateet);

            return appdateetstr;
        }
        else return null;
    };

    var months = ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"];
    // function used to convert from gregorian date to ethiopian date with textulal month names
    var gregToEthMonthName = function (gregdate) {
        try {
            if (!gregdate) return null;
            var dmy;
            dmy = gregdate.split("-");// first try the - separator
            if (dmy.length != 3) dmy = gregdate.split("/");// then try the / separator
            if (dmy.length == 3) {
                var appdate = jQuery.calendars.instance('gregorian').newDate(parseInt(dmy[2], 10), parseInt(dmy[0], 10), parseInt(dmy[1], 10));
                var jd = jQuery.calendars.instance('gregorian').toJD(appdate);
                var appdateet = jQuery.calendars.instance('ethiopian').fromJD(jd);
                // var appdateetstr = jQuery.calendars.instance('ethiopian').formatDate('dd/mmm/yyyy', appdateet);
                return months[appdateet.month() - 1] + "/" + appdateet.day() + "/" + appdateet.year();
            }
            else return null;
        }
        catch (e) {
            return null;
        }
    };

    return {
        gregToEth: gregToEth,
        ethToGreg: ethToGreg,
        gregToEthMonthName: gregToEthMonthName
    };
});
