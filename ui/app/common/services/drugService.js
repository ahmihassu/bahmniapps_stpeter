'use strict';
angular.module('bahmni.common.services')
    .factory('drugService', ['$http', function ($http) {
        var v = 'custom:(uuid,strength,name,dosageForm,concept:(uuid,name,names:(name)))';
        var search = function (drugName, conceptUuid) {
            var params = {
                v: v,
                q: drugName,
                conceptUuid: conceptUuid,
                s: "ordered"
            };
            return $http.get(Bahmni.Common.Constants.drugUrl, {
                method: "GET",
                params: params,
                withCredentials: true
            }).then(function (response) {
                return response.data.results;
            });
        };

        var stock = function (stockURL, DU) {
            return $http.get(stockURL+'/'+DU, {
                method: "GET",
            }).then(function (response) {
                return response.data.model;
            });
        };
        var stockPerItem = function (itemStockURL, DU, itemId) {
            return $http.get(itemStockURL+'/'+DU+'/'+itemId, {
                method: "GET",
            }).then(function (response) {
                return response.data.model;
            });
        };
        var DU = function (duURL) {
            return $http.get(duURL, {
                method: "GET",
            }).then(function (response) {
                return response.data.model;
            });
        };

        var getSetMembersOfConcept = function (conceptSetFullySpecifiedName, searchTerm) {
            return $http.get(Bahmni.Common.Constants.drugUrl, {
                method: "GET",
                params: {
                    v: v,
                    q: conceptSetFullySpecifiedName,
                    s: "byConceptSet",
                    searchTerm: searchTerm
                },
                withCredentials: true
            }).then(function (response) {
                return response.data.results;
            });
        };

        var getRegimen = function (patientUuid, patientProgramUuid, drugs) {
            var params = {
                patientUuid: patientUuid,
                patientProgramUuid: patientProgramUuid,
                drugs: drugs
            };

            return $http.get(Bahmni.Common.Constants.bahmniRESTBaseURL + "/drugOGram/regimen", {
                params: params,
                withCredentials: true
            });
        };

        return {
            search: search,
            stock: stock,
            DU: DU,
            stockPerItem: stockPerItem,
            getRegimen: getRegimen,
            getSetMembersOfConcept: getSetMembersOfConcept
        };
    }]);
