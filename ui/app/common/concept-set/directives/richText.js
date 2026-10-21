'use strict';

angular.module('bahmni.common.conceptSet')
  .directive('richText', function () {
    return {
      restrict: 'E',
      scope: {
        observation: '=',
        context: '=?'
      },
      template: `<div ng-attr-id="{{::(observation.uniqueId || observation.$$hashKey)}}">
                        <div class="summernote_canvas" ng-model="observation.value"></div>
                        <span class="right" ng-if="observation.concept.name == 'Radiology Notes' ">{{::observation.providers[0].name}}</span>
                </div>`,
      link: function (scope, element, attrs) {
        var par_target = angular.element(element[0].childNodes[0]);
        var init = function (target_id) {
          let x = angular.element(document.getElementById(target_id))
          let target = angular.element(x[0].childNodes[1]);
          target.summernote({
            height: 300, // Set the editor height
            toolbar: [
              ['style', ['style']],
              ['font', ['bold', 'italic', 'underline', 'clear', 'fontsize']],
              ['para', ['ul', 'ol', 'paragraph']],
              ['insert', ['link', 'picture']]
            ],
          });
          
          var textArea = target[0].parentElement.children[1].children[2].children[2];
          var alpha = angular.element(textArea)
          if (scope.observation.value) {
            alpha[0].innerHTML = scope.observation.value;
          }
          
          if (scope.context) {
            target.summernote('disable');
            textArea.style.backgroundColor = 'white';
          }
          else {
            textArea.addEventListener('blur', function (event) {
              scope.observation.value = target.summernote('code');
            })
          }
        }
        

        
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'id') {
              var element = mutation.target;
              var newId = element.id;
              init((scope.observation.uniqueId || scope.observation.$$hashKey))
            }
          });
        });
        
        observer.observe(par_target[0], { attributes: true });

      }
    };
  });