'use strict';

angular.module('bahmni.common.domain')
    .service('commonNameDictionaryService', ['$http', '$rootScope', function ($http, $rootScope) {
        var self = this;

        this.getCommonNamesFor = function (searchTerm) {
            var url = Bahmni.Common.Constants.emrapiCommonNamesUrl;
            return $http.get(url, {
                params: {term: searchTerm, limit: 20}
            });
        };
        
    }]);
