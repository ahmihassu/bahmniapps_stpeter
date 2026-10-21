'use strict';

angular.module('bahmni.common.ethiopianDateSelector').directive('ethiopianCalendarInputForDateTypeField', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input ng-required="required" ng-model="smthn" ng-change="forLnmp()" ng-disabled="disabled" placeholder=" ቀን"/></div>' +
               "<div>",
        scope: {
            date: "=?",
            handler: "&",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            placeholder: "=?",
            model: '=?',
            observation: '=?'
        },
        link: function (scope, element, attrs) {
            var today = new Date();
            scope.forLnmp = function(){
                if(!scope.smthn && scope.observation.label == "LNMP"){
                    scope.$root.$broadcast("lnmpCleared", {});
                }
            }
            if(scope.observation && scope.observation.label == "EDD"){scope.disabled = true}
            if(!scope.model){
                if(scope.observation.label != "EDD" && scope.observation.label != "LNMP" && !scope.observation.concept.name.includes("Bacteriology")){
                    scope.date = today;
                    scope.model = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" +  today.getDate();
                }
                
            }
            if(scope.model) scope.date = new Date(scope.model)
            
            
            $(element[0].childNodes[0].childNodes[0]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            var calendar = $.calendars.instance('ethiopian', 'am');
            $('.calendars-popup').css({'z-index': 99999 });
            
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.model = greg.getFullYear() + "-" + (greg.getMonth() + 1) + "-" +  greg.getDate();
                    if(scope.observation && scope.observation.label == "LNMP") {
                        scope.$root.lnmp = scope.model;
                        scope.$root.lnmpd = scope.date;
                        scope.$root.$broadcast("lnmpEntered", {}); 
                    }
                    if(scope.observation && scope.observation.label == "EDD") {
                        if(scope.$root.lnmp){
                            scope.model = scope.$root.lnmp;
                            scope.date = scope.$root.lnmpd
                        }
                    }
                    scope.$apply();
                    scope.handler();
                    scope.$apply();
                },
                minDate: minDate ? ethiopianGregorianService.gregToEth((minDate.getMonth() + 1) + "/" + minDate.getDate() + "/" + minDate.getFullYear()) : null,
                holidays: Bahmni.Common.EthiopianDateSelector.constants.holidays
            });
            scope.$watch('date', function (val) {
                // calculate the ethiopian date based on the gregorian
                if (!val) return;
                var eth = ethiopianGregorianService.gregToEth((val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear());
                $(element[0].childNodes[0].childNodes[0]).val(eth);
            });
            function addDays(date, days) {
                var result = new Date(date);
                result.setDate(result.getDate() + days);
                return result;
            }
            scope.$on('lnmpEntered', function (event, args) {
                if(scope.observation && scope.observation.label == "EDD") {
                    if(scope.$root.lnmp){
                        var tod = new Date();
                        tod = addDays(scope.$root.lnmpd, 280);
                        scope.date = tod;
                        scope.model = tod.getFullYear() + "-" + (tod.getMonth() + 1) + "-" +  tod.getDate();
                    }
                }
            });
            scope.$on('lnmpEntered', function (event, args) {
                if (scope.observation && scope.observation.label == "LNMP") {
                    if (scope.$root.lnmp) {
                        scope.$root.$broadcast("lnmpUpdated", { lnmpDate: scope.$root.lnmpd });
                    }
                }
            });
            scope.$on('lnmpCleared', function (event, args) {
                if(scope.observation.label == "EDD") {
                    scope.model = undefined
                    scope.smthn = " ቀን"
                }
                if(scope.observation.label == "LNMP") {
                    scope.model = undefined
                }
            });

            scope.handler();

        }
    };
}]);