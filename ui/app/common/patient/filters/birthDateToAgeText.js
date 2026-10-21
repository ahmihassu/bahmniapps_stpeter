'use strict';

angular.module('bahmni.common.patient')
    .filter('birthDateToAgeText', ['$filter', '$translate', function ($filter, $translate) {
        return function (birthDate, birthtime) {
            var DateUtil = Bahmni.Common.Util.DateUtil;
            if (birthDate) {
                var now = DateUtil.now();
                var birthDateTime = new Date(birthDate);
                
                if (birthtime && birthtime instanceof Date) {
                    var adjustedBirthtime = new Date(birthtime.getTime() - (3 * 60 * 60 * 1000));
                    birthDateTime.setHours(
                        adjustedBirthtime.getHours(),
                        adjustedBirthtime.getMinutes(),
                        adjustedBirthtime.getSeconds(),
                        adjustedBirthtime.getMilliseconds()
                    );
                }
                
                var nowDateTime = new Date(now);
                var ageInMs = nowDateTime - birthDateTime;
                var ageInHours = Math.floor(ageInMs / (1000 * 60 * 60));
                var ageInMinutes = Math.floor(ageInMs / (1000 * 60));
                var remainingMinutes = ageInMinutes % 60;
                
                if (ageInHours >= 0 && ageInHours < 24) {
                    if (ageInHours === 0) {
                        if (ageInMinutes === 0) return "Just born";
                        if (ageInMinutes === 1) return "1 minute";
                        return ageInMinutes + " minutes";
                    }
                    if (ageInHours === 1) {
                        if (remainingMinutes === 0) return "1 hour";
                        if (remainingMinutes === 1) return "1 hour 1 minute";
                        return "1 hour " + remainingMinutes + " minutes";
                    }
                    if (remainingMinutes === 0) return ageInHours + " hours";
                    if (remainingMinutes === 1) return ageInHours + " hours 1 minute";
                    return ageInHours + " hours " + remainingMinutes + " minutes";
                }
                
                var age = DateUtil.diffInYearsMonthsDays(birthDate, now);
                var ageInString = "";
                if (age.years) {
                    ageInString += age.years + " " + $translate.instant("CLINICAL_YEARS_TRANSLATION_KEY") + " ";
                }
                if (age.months) {
                    ageInString += age.months + " " + $translate.instant("CLINICAL_MONTHS_TRANSLATION_KEY") + " ";
                }
                if (age.days) {
                    ageInString += age.days + " " + $translate.instant("CLINICAL_DAYS_TRANSLATION_KEY") + " ";
                }
                return ageInString.trim();
            } else {
                return "";
            }
        };
    }]);
