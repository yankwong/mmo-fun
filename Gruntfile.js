module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sass: {
      dist: {
        files: {
          './assets/css/main.css': './assets/scss/main.scss',
          './assets/css/game.css': './assets/scss/game.scss',
          './assets/css/test1.css': './assets/scss/test1.scss'
        }
      }
    },
    watch: {
      files: ['assets/scss/*.scss'],
      tasks: ['sass']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['uglify', 'sass', 'watch']);

};