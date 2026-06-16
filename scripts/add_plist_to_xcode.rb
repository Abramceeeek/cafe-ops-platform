#!/usr/bin/env ruby
# add_plist_to_xcode.rb  —  add a .plist to the Flutter Runner target so it ships
# in the .app bundle (needed for firebase_core to read GoogleService-Info.plist at
# runtime). flutter create puts it on disk but NOT in the target.
#
# Usage: ruby scripts/add_plist_to_xcode.rb <app_dir> <plist_basename>
#   e.g. (cwd = apps/<app>)  ruby ../../scripts/add_plist_to_xcode.rb . GoogleService-Info
require 'xcodeproj'

app_dir    = ARGV[0] || '.'
plist_base = ARGV[1] || 'GoogleService-Info'
plist_file = "#{plist_base}.plist"
proj_path  = File.join(app_dir, 'ios', 'Runner.xcodeproj')
plist_full = File.expand_path(File.join(app_dir, 'ios', 'Runner', plist_file))

abort("ERROR: #{plist_file} not found at #{plist_full}") unless File.exist?(plist_full)
abort("ERROR: #{proj_path} not found") unless File.exist?(proj_path)

project = Xcodeproj::Project.open(proj_path)
target  = project.targets.find { |t| t.name == 'Runner' } or abort('ERROR: Runner target not found')

# Find (or create) the Runner group.
runner_group = project.main_group.recursive_children.find do |n|
  n.is_a?(Xcodeproj::Project::Group) && n.display_name == 'Runner'
end || project.main_group['Runner'] || project.main_group.new_group('Runner', 'Runner')

# Add the file reference if absent.
ref = runner_group.files.find { |f| File.basename(f.path.to_s) == plist_file } ||
      runner_group.new_reference(plist_full)

# Add to the Copy Bundle Resources phase if absent.
phase = target.resources_build_phase
if phase.files_references.include?(ref)
  puts "#{plist_file} already in Copy Bundle Resources."
else
  phase.add_file_reference(ref)
  puts "Added #{plist_file} to Runner Copy Bundle Resources."
end

project.save
puts "OK: #{plist_file} is in the Runner target."
