'use strict';
angular.module('bahmni.registration')
    .controller('availabilityController', ['$http', '$scope', 'spinner', 'conceptSetService', 'locationService',
        function ($http, $scope, spinner, conceptSetService, locationService) {
            $scope.tabs = [];
            $scope.selectedOrdType = {}
            $scope.strselectedPanel = ""
            $scope.alluuids = {}
            var getMappingTypeUuid = function () {
                $http.get(Bahmni.Common.Constants.conceptMapUrl, {
                    method: "GET",
                    withCredentials: true
                }).then(
                    res => {
                        res.data.results.map(map_type => {
                            if (map_type.display == "Associated with") {
                                $scope.alluuids.mappingType = map_type.uuid
                                return
                            }
                        })
                    }
                )
            }
            var getSourceUuid = function () {
                $http.get(Bahmni.Common.Constants.conceptSourceUrl, {
                    method: "GET",
                    withCredentials: true
                }).then(
                    res => {
                        res.data.results.map(map_type => {
                            if (map_type.display == "Availability") {
                                $scope.alluuids.source = map_type.uuid
                                return
                            }
                        })
                    }
                )
            }
            var getReferenceUuid = function () {
                $http.get(Bahmni.Common.Constants.conceptReferenceUrl, {
                    method: "GET",
                    withCredentials: true,
                    params: { q: "False" }
                }).then(
                    res => {
                        res.data.results.map(map_type => {
                            if (map_type.display.includes("Availability")) {
                                $scope.alluuids.reference = map_type.uuid
                                return
                            }
                        })
                    }
                )
            }
            var getConceptAvailability = function (uuid) {
                return $http.get(Bahmni.Common.Constants.conceptUrl + "/" + uuid + "/mapping", {
                    method: "GET",
                    withCredentials: true
                });
            }
            var setConceptAvailable = async function (uuid) {
                var headers = { "Content-Type": "application/json", "Accept": "application/json" };
                var payload = {
                    "mappings": $scope.filteredMap
                }
                return $http.post(Bahmni.Common.Constants.conceptUrl + "/" + uuid, payload, headers);
            }
            var setConceptUnAvailable = async function (uuid) {
                var headers = { "Content-Type": "application/json", "Accept": "application/json" };
                var stuffed = [...$scope.filteredMap]
                stuffed.push({
                    "conceptReferenceTerm": {
                        "conceptSource": {
                            "uuid": $scope.alluuids.source
                        },
                        "uuid": $scope.alluuids.reference,
                        "name": "False",
                        "code": "False",
                        "version": "1.9"
                    },
                    "conceptMapType": {
                        "uuid": $scope.alluuids.mappingType,
                        "name": "Associated with",
                        "description":null,
                        "isHidden": false
                    }
                })
                
                var payload = {
                    "mappings": stuffed
                }
                return $http.post(Bahmni.Common.Constants.conceptUrl + "/" + uuid, payload, headers);
            }
            $scope.toggleAvailability = async function () {
                if ($scope.currAvailability.length == 0) {
                    spinner.forPromise(setConceptUnAvailable($scope.selectedTest.uuid)).then(x => refreshAvailability())
                }
                else {
                    spinner.forPromise(setConceptAvailable($scope.selectedTest.uuid)).then(x => refreshAvailability())
                }
            }
            var allOrderables = conceptSetService.getConcept({ name: "All Orderables", v: "custom:(uuid,name:(display,uuid),names:(display,conceptNameType,name),set,setMembers:(uuid,name:(display,uuid),names:(display,conceptNameType,name),set,setMembers:(uuid,name:(display,uuid),names:(display,conceptNameType,name),set,conceptClass:(uuid,name,description),setMembers:(uuid,name:(display,uuid),names:(display,conceptNameType,name),set,conceptClass:(uuid,name,description),mappings,setMembers:(uuid,name:(display,uuid),names:(display,conceptNameType,name),set,conceptClass:(uuid,name,description))))))" }).then(function (response) {
                var allOrderables = {};
                _.forEach(response.data.results[0].setMembers, function (orderable) {
                    var conceptName = _.find(orderable.names, { conceptNameType: "FULLY_SPECIFIED" });
                    conceptName = conceptName ? conceptName.name : conceptName;
                    allOrderables['\'' + conceptName + '\''] = orderable;
                });
                $scope.orderables = allOrderables;
                return allOrderables;
            });
            $scope.getName = function (sample) {
                var name = _.find(sample.names, { conceptNameType: "SHORT" }) || _.find(sample.names, { conceptNameType: "FULLY_SPECIFIED" });
                return name && name.name;
            };
            $scope.refreshOT = function () {
                $scope.selectedOrdType = JSON.parse($scope.orderTypeName)
                $scope.selectedPanel = {}
                $scope.selectedTest = {}
                $scope.currentAvailability = undefined
            }
            $scope.refreshPan = function (x) {
                $scope.selectedPanel = JSON.parse(x)
                $scope.selectedTest = {}
                $scope.currentAvailability = undefined
            }
            $scope.refreshTest = function (x) {
                $scope.selectedTest = JSON.parse(x)
                $scope.filteredMap = []
                getConceptAvailability($scope.selectedTest.uuid).then(res => {
                    $scope.currAvailability = res.data.results.filter(map_obj => {
                        return map_obj.display.includes("Availability")
                    })
                    $scope.filteredMap = res.data.results.filter(map_obj => {
                        return !map_obj.display.includes("Availability")
                    })
                    $scope.boolAvailability = $scope.currAvailability.length == 0
                })
            }
            var refreshAvailability = function() {
                $scope.filteredMap = []
                getConceptAvailability($scope.selectedTest.uuid).then(res => {
                    $scope.currAvailability = res.data.results.filter(map_obj => {
                        return map_obj.display.includes("Availability")
                    })
                    $scope.filteredMap = res.data.results.filter(map_obj => {
                        return !map_obj.display.includes("Availability")
                    })
                    $scope.boolAvailability = $scope.currAvailability.length == 0
                })
            }
            var initialize = async function () {
                getMappingTypeUuid()
                getSourceUuid()
                getReferenceUuid()
                var promise = allOrderables
                spinner.forPromise(allOrderables).then(x => init())
            };
            var init = function () {
            }
            initialize();
        }
    ]);