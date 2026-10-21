'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('gastrointestinalChart', ['appService', '$http','$timeout','$rootScope', function (appService, $http, $timeout, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                abnormalObs: '=?',
                patient: '=',
                fixed: '=?',
                type: '='
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
                
                scope.coordinates = { x: "", y: "" }
                scope.symbol = "🔴"
                scope.items = []
                
                if (scope.observation.value) {
                    scope.items = JSON.parse(scope.observation.value)
                }
                
                scope.toggleOn = function (event) {
                    if(!scope.fixed){
                        const img = $(element[0].childNodes[0].childNodes[1])

                        const offset = $(img).offset();

                        var item = {css:{left: "", top: ""}}

                        item.css.left = Math.floor(event.pageX - offset.left) - 9;
                        item.css.top = Math.floor(event.pageY - offset.top) - 6;
                        item.display = true;
                        
                        scope.items.push(item)
                        scope.observation.value = JSON.stringify(_.filter(scope.items,function(item){
                            return item.display
                        }))
                    }
                }
                
                scope.toggleOff = function(item){
                    if(!scope.fixed){
                        item.display = false
                        scope.observation.value = JSON.stringify(_.filter(scope.items,function(item){
                            return item.display
                        }))    
                }
            }
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/gastrointestinalChart.html'
        };
    }]);