'use strict';

angular.module('bahmni.registration')
    .controller('TriageDashboardController', ['$scope', '$state', 'appService', function ($scope, $state, appService) {
        $scope.appExtensions = appService.getAppDescriptor().getExtensions($state.current.data.extensionPointId, "link") || [];
    }]);