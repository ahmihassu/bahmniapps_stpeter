'use strict';

angular.module('bahmni.common.uiHelper')
    .directive('providerDirective', ['$http', function ($http) {
        var template = '<span>' +
            '<span ng-if=":: creatorName && providerName && (creatorName != providerName)">{{::creatorName}} {{"ON_BEHALF_OF_TRANSLATION_KEY"|translate}} </span>' +
            '<span ng-if="providerAttributes.length">{{providerAttributes.join(", ")}} </span>{{::providerName}}' +
            '<span ng-if=":: providerDate"> {{::providerDate | bahmniTime}} </span>' +
        '</span>';

        function searchByUuid1(uuid) {
            return $http.get(Bahmni.Common.Constants.providerUrl + "/" + uuid, {
                method: "GET",
                params: {},
                cache: false
            });
        }

        return {
            restrict: 'EA',
            replace: true,
            scope: {
                creatorName: "@",
                providerName: "@",
                providerDate: "=?",
                providerUuid: "@"
            },
            template: template,
            link: function(scope) {
                scope.providerAttributes = [];
                if (scope.providerUuid) {
                    searchByUuid1(scope.providerUuid).then(function (response) {
                        if (response.data.attributes && response.data.attributes.length) {
                            response.data.attributes.forEach(function(attr) {
                                if (attr.display) {
                                    var parts = attr.display.split(':');
                                    if (parts.length === 2 && parts[1].trim() === 'true') {
                                        var name = parts[0].trim();
                                        // Check if name is wrapped in double asterisks
                                        if (/^\*\*.*\*\*$/.test(name)) {
                                            // Remove the asterisks for display
                                            scope.providerAttributes.push(name.replace(/^\*\*(.*)\*\*$/, '$1'));
                                        }
                                    }
                                }
                            });
                        }
                    }, function (error) {
                        console.error("Error fetching provider by UUID:", error);
                    });
                }
            }
        };
    }]);