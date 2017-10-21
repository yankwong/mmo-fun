module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sass: {
      dist: {
        files: {
          './assets/css/main.css': './assets/scss/main.scss',
          './assets/css/game.css': './assets/scss/game.scss',
          './assets/css/cardmove.css': './assets/scss/cardmove.scss'
        }
      }
    },
    concat: {
      app: {
        src: [
          './assets/javascripts/*.js',
          '!./assets/javascripts/database-config.js'
        ],
        dest: './assets/dist/app.js'
      }
    },
    watch: {
      sass: {
        files: ['assets/scss/*.scss'],
        tasks: ['sass']  
      },
      concat: {
        files: ['./assets/javascripts/*.js'],
        tasks: ['concat']
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');

  // Default task(s).
  grunt.registerTask('default', ['uglify', 'sass', 'watch', 'concat']);

};