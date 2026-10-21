'use strict';

angular.module('bahmni.common.ethiopianDateSelector').directive('ethiopianDateTimeSelector', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input ng-required="required" ng-disabled="observation.disabled" placeholder=" ቀን"/></div>' +
               "<div>" +
                    "<input type='time' ng-disabled='observation.disabled' ng-selected='updateModel()' ng-model='selectedTime'/>" +
                "</div>",
        scope: {
            date: "=?",
            handler: "&",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            placeholder: "=?",
            model: '=?',
            observation: "=?",
            time: "=?"
        },
        link: function (scope, element, attrs) {
            
            var getSelectedTimeStr = function () {
                return scope.selectedTime != null ? moment(scope.selectedTime).format("HH:mm") : "";
            };

            scope.updateModel = function () {
                if (!scope.noSave && scope.date) {
                    scope.time = getSelectedTimeStr();
                    scope.model = scope.date.getFullYear() + "-" + (scope.date.getMonth() + 1) + "-" + scope.date.getDate() + " " + scope.time;
                }
            };
            // if(scope.observation.concept.name == "Trige Date and time of Arrival" || scope.observation.concept.name == "Trige Date and Time of Triage")
            if(scope.observation){
                if(scope.observation.concept.name != "Triage Date of Onset" && scope.observation.concept.name != "Labor starting time" && scope.observation.concept.name != "If membrane is ruptured, time of ROM")
                {
                var today = new Date();
                today.setMilliseconds(0);
            today.setSeconds(0);
            scope.selectedTime = today;
            //scope.date = today;
            scope.updateModel();
                }
            }
            if (scope.model) {
                if (scope.model == "now"){
                    var today = new Date();
                    today.setMilliseconds(0);
                    today.setSeconds(0);
                    scope.model = today;
    
                }
                var date = moment(scope.model).toDate();
                scope.date = date;
                scope.selectedTime = date;
                scope.updateModel();
            }
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            var calendar = $.calendars.instance('ethiopian', 'am');
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.updateModel();
                    scope.model = greg.getFullYear() + "-" + (greg.getMonth() + 1) + "-" +  greg.getDate() + " " + scope.time;
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

            
            $(element[0].childNodes[1].childNodes[0]).on('input', function(e) 
            {
                scope.time = e.target.value;
                scope.model = scope.date.getFullYear() + "-" + (scope.date.getMonth() + 1) + "-" +  scope.date.getDate() + " " + scope.time;
                    scope.$apply();
                    scope.handler();
                    scope.$apply();
            
            });

            scope.$on('refreshDateTime', function (event, args) {
                if (scope.observation.concept && scope.observation.concept.name == args.type) {
                    let setDate = new Date(args.time.split("+")[0]);
                    scope.observation.disabled = true;
                    scope.selectedTime = setDate;
                    scope.date = setDate;
                    scope.updateModel();
                }
            });
            
            scope.handler();
        }
    };
}]);