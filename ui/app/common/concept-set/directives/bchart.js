'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('bchart', ['appService', '$http', function (appService, $http) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                abnormalObs: '=?',
                patient:'=',
                fixed: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                var one_year = 1000 * 60 * 60 * 24 * 365.25
                var date1 = new Date($scope.patient.birthdate)
                var date2 = new Date()
                var ageY = Math.floor((date2.getTime() - date1.getTime())/one_year);
                var tab_vals = {}
                var calculate_coverage = function(par){
                    var total = 0

                    if(par.fh){
                        total = total + tab_vals.a
                    }
                    if(par.bh){
                        total = total + tab_vals.a
                    }
                    if(par.fn){
                        total = total + 1
                    }
                    if(par.bn){
                        total = total + 1
                    }
                    if(par.ft){
                        total = total + 13
                    }
                    if(par.bt){
                        total = total + 13
                    }
                    if(par.fg){
                        total = total + 1
                    }
                    if(par.blb){
                        total = total + 2.5
                    }
                    if(par.brb){
                        total = total + 2.5
                    }
                    if(par.fra){
                        total = total + 2
                    }
                    if(par.fla){
                        total = total + 2
                    }
                    if(par.bra){
                        total = total + 2
                    }
                    if(par.bla){
                        total = total + 2
                    }
                    if(par.frfa){
                        total = total + 1.5
                    }
                    if(par.flfa){
                        total = total + 1.5
                    }
                    if(par.brfa){
                        total = total + 1.5
                    }
                    if(par.blfa){
                        total = total + 1.5
                    }
                    if(par.frh){
                        total = total + 1.5
                    }
                    if(par.flh){
                        total = total + 1.5
                    }
                    if(par.brh){
                        total = total + 1.5
                    }
                    if(par.blh){
                        total = total + 1.5
                    }
                    if(par.frt){
                        total = total + tab_vals.b
                    }
                    if(par.flt){
                        total = total + tab_vals.b
                    }
                    if(par.brt){
                        total = total + tab_vals.b
                    }
                    if(par.blt){
                        total = total + tab_vals.b
                    }
                    if(par.frl){
                        total = total + tab_vals.c
                    }
                    if(par.fll){
                        total = total + tab_vals.c
                    }
                    if(par.brl){
                        total = total + tab_vals.c
                    }
                    if(par.bll){
                        total = total + tab_vals.c
                    }
                    if(par.frf){
                        total = total + 1.75
                    }
                    if(par.flf){
                        total = total + 1.75
                    }
                    if(par.brf){
                        total = total + 1.75
                    }
                    if(par.blf){
                        total = total + 1.75
                    }
                    return total
                }
                if(ageY<1){
                    tab_vals = {
                        a : 9.5,
                        b : 2.75,
                        c : 2.5
                    }
                }
                else if(ageY<5){
                    tab_vals = {
                        a : 8.5,
                        b : 3.25,
                        c : 2.5
                    }
                }
                else if(ageY<10){
                    tab_vals = {
                        a : 6.5,
                        b : 4,
                        c : 2.75
                    }
                }
                else if(ageY<15){
                    tab_vals = {
                        a : 5.5,
                        b : 4.25,
                        c : 3
                    }
                }
                else{
                    tab_vals = {
                        a : 4.5,
                        b : 4.5,
                        c : 3.25
                    }
                }
                var parsed = {
                    "fh": false,
                    "fn": false,
                    "ft": false,
                    "fla": false,
                    "flfa": false,
                    "flh" : false,
                    "flt" : false,
                    "fll" : false,
                    "flf": false,
                    "fra": false,
                    "frfa": false,
                    "frh" : false,
                    "frt" : false,
                    "frl" : false,
                    "frf": false,
                    "fg": false,

                    "bh": false,
                    "bn": false,
                    "bt": false,
                    "bla": false,
                    "blfa": false,
                    "blh" : false,
                    "blt" : false,
                    "bll" : false,
                    "blf": false,
                    "blb": false,
                    "bra": false,
                    "brfa": false,
                    "brh" : false,
                    "brt" : false,
                    "brl" : false,
                    "brf": false,
                    "brb": false
                }
                if($scope.observation.value){
                    parsed = JSON.parse($scope.observation.value)
                }
                $scope.observation.calculated = calculate_coverage(parsed)
                parsed.cc = $scope.observation.calculated
                $scope.head_front = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "53.5%", 
                        "height": "8%", 
                        "margin-top": "3%",
                        "opacity": parsed.fh ? 0.75 : 0
                    },
                    "value": "fh"
                }

                $scope.neck_front = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "53.7%", 
                        "height": "2.6%", 
                        "margin-top": "8.8%",
                        "opacity": parsed.fn ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "fn"
                }

                $scope.torso_front = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "50.5%", 
                        "height": "20%", 
                        "margin-top": "10%",
                        "opacity": parsed.ft ? 0.75 : 0,
                        "z-index": 97
                    },
                    "value": "ft"
                }

                $scope.arm_front_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "49.5%", 
                        "height": "10.5%", 
                        "margin-top": "12%",
                        "opacity": parsed.fra ? 0.75 : 0,
                        "z-index": 98
                    },
                    "value": "fra"
                }

                $scope.fore_arm_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "48.5%", 
                        "height": "7.8%", 
                        "margin-top": "19.7%",
                        "opacity": parsed.frfa ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotate(19deg)"
                    },
                    "value": "frfa"
                }

                $scope.hand_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "45.7%", 
                        "height": "6.5%", 
                        "margin-top": "25.7%",
                        "opacity": parsed.frh ? 0.75 : 0,
                        "z-index": 100,
                        "transform": "rotate(5deg)"
                    },
                    "value": "frh"
                }


                $scope.arm_front_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "60%", 
                        "height": "10.5%", 
                        "margin-top": "12%",
                        "opacity": parsed.fla ? 0.75 : 0,
                        "z-index": 98,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "fla"
                }

                $scope.fore_arm_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "61.2%", 
                        "height": "7.8%", 
                        "margin-top": "19.7%",
                        "opacity": parsed.flfa ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotateY(180deg) rotate(19deg)"
                    },
                    "value": "flfa"
                }

                $scope.hand_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "61.9%", 
                        "height": "6.5%", 
                        "margin-top": "25.7%",
                        "opacity": parsed.flh ? 0.75 : 0,
                        "z-index": 100,
                        "transform": "rotateY(180deg) rotate(5deg)"
                    },
                    "value": "flh"
                }

                $scope.thigh_front_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "51.2%", 
                        "height": "17%", 
                        "margin-top": "24.5%",
                        "opacity": parsed.frt ? 0.75 : 0,
                        "z-index": 98
                    },
                    "value": "frt"
                }

                $scope.thigh_front_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "55.5%", 
                        "height": "16.8%", 
                        "margin-top": "24.5%",
                        "opacity": parsed.flt ? 0.75 : 0,
                        "z-index": 98,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "flt"
                }

                $scope.leg_front_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "52.2%", 
                        "height": "11%", 
                        "margin-top": "36.5%",
                        "opacity": parsed.frl ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "frl"
                }

                $scope.leg_front_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "55.5%", 
                        "height": "11%", 
                        "margin-top": "36.5%",
                        "opacity": parsed.fll ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "fll"
                }

                $scope.foot_front_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "52%", 
                        "height": "6.5%", 
                        "margin-top": "44%",
                        "opacity": parsed.frf ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "frf"
                }

                $scope.foot_front_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "56%", 
                        "height": "6.5%", 
                        "margin-top": "44%",
                        "opacity": parsed.flf ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "flf"
                }

                $scope.groin = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "51%", 
                        "height": "6.5%", 
                        "margin-top": "23.6%",
                        "opacity": parsed.fg ? 0.75 : 0,
                        "z-index": 99,
                        "clip-path": "circle(13px)"
                    },
                    "value": "fg"
                }

                $scope.head_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "79.3%", 
                        "height": "7.4%", 
                        "margin-top": "2.6%",
                        "opacity": parsed.bh ? 0.75 : 0
                    },
                    "value": "bh"
                }

                $scope.neck_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "82%", 
                        "height": "3.2%", 
                        "margin-top": "8%",
                        "opacity": parsed.bn ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "bn"
                }

                $scope.torso_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "78.8%", 
                        "height": "16%", 
                        "margin-top": "10.2%",
                        "opacity": parsed.bt ? 0.75 : 0,
                        "z-index": 97
                    },
                    "value": "bt"
                }

                $scope.arm_back_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "77.5%", 
                        "height": "11.5%", 
                        "margin-top": "12%",
                        "opacity": parsed.bra ? 0.75 : 0,
                        "z-index": 98
                    },
                    "value": "bra"
                }

                $scope.fore_arm_right_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "76.3%", 
                        "height": "8%", 
                        "margin-top": "20.7%",
                        "opacity": parsed.brfa ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotate(19deg)"
                    },
                    "value": "brfa"
                }

                $scope.hand_right_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "74%", 
                        "height": "6.5%", 
                        "margin-top": "26.8%",
                        "opacity": parsed.brh ? 0.75 : 0,
                        "z-index": 100,
                        "transform": "rotate(5deg)"
                    },
                    "value": "brh"
                }

                $scope.arm_back_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "87.5%", 
                        "height": "11%", 
                        "margin-top": "12%",
                        "opacity": parsed.bla ? 0.75 : 0,
                        "z-index": 98,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "bla"
                }

                $scope.fore_arm_left_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "88.7%", 
                        "height": "8.6%", 
                        "margin-top": "20.2%",
                        "opacity": parsed.blfa ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotateY(180deg) rotate(19deg)"
                    },
                    "value": "blfa"
                }

                $scope.hand_left_back = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "89.5%", 
                        "height": "7.3%", 
                        "margin-top": "26.7%",
                        "opacity": parsed.blh ? 0.75 : 0,
                        "z-index": 100,
                        "transform": "rotateY(180deg) rotate(5deg)"
                    },
                    "value": "blh"
                }

                $scope.butt_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "83.8%", 
                        "height": "8%", 
                        "margin-top": "21.5%",
                        "opacity": parsed.blb ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "blb"
                }

                $scope.butt_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "79.5%", 
                        "height": "7.5%", 
                        "margin-top": "21.7%",
                        "opacity": parsed.brb ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "brb"
                }

                $scope.thigh_back_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "79.3%", 
                        "height": "15%", 
                        "margin-top": "25.7%",
                        "opacity": parsed.brt ? 0.75 : 0,
                        "z-index": 98,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "brt"
                }

                $scope.thigh_back_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "83.8%", 
                        "height": "15%", 
                        "margin-top": "25.7%",
                        "opacity": parsed.blt ? 0.75 : 0,
                        "z-index": 98
                    },
                    "value": "blt"
                }

                $scope.leg_back_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "80.8%", 
                        "height": "12%", 
                        "margin-top": "36.8%",
                        "opacity": parsed.brl ? 0.75 : 0,
                        "z-index": 99,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "brl"
                }

                $scope.leg_back_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "83.6%", 
                        "height": "12%", 
                        "margin-top": "36.8%",
                        "opacity": parsed.bll ? 0.75 : 0,
                        "z-index": 99
                    },
                    "value": "bll"
                }

                $scope.foot_back_right = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "80%", 
                        "height": "5%", 
                        "margin-top": "45.5%",
                        "opacity": parsed.brf ? 0.75 : 0,
                        "z-index": 100,
                        "transform": "rotateY(180deg)"
                    },
                    "value": "brf"
                }

                $scope.foot_back_left = {
                    "css": {
                        "position": "absolute", 
                        "inset": "0", 
                        "margin-left": "84.05%", 
                        "height": "5%", 
                        "margin-top": "45.5%",
                        "opacity": parsed.blf ? 0.75 : 0,
                        "z-index": 100
                    },
                    "value": "blf"
                }

                $scope.toggle = function (body_part){
                    if(!$scope.fixed){
                        parsed[body_part.value] = !parsed[body_part.value] 
                        parsed[body_part.value] ? body_part.css.opacity = 0.75 : body_part.css.opacity = 0  
                        $scope.observation.calculated = calculate_coverage(parsed)
                        parsed.cc = $scope.observation.calculated
                        $scope.observation.value = JSON.stringify(parsed)
                    }
                    
                }
                
                
                
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/bchart.html'
        };
    }]);