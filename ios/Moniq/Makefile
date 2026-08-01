PROJECT := Moniq.xcodeproj
SCHEME := Moniq
XCODEGEN ?= $(if $(wildcard $(HOME)/.local/bin/xcodegen),$(HOME)/.local/bin/xcodegen,xcodegen)
DESTINATION ?= platform=iOS Simulator,name=iPhone 17 Pro

ifneq ($(wildcard /Applications/Xcode.app/Contents/Developer),)
export DEVELOPER_DIR ?= /Applications/Xcode.app/Contents/Developer
endif

.PHONY: project open build build-ios test test-ios ui-test-ios destinations clean

project:
	$(XCODEGEN) generate

open: project
	open $(PROJECT)

build-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO build

test-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO test -only-testing:MoniqTests

ui-test-ios: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -destination '$(DESTINATION)' CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO test -only-testing:MoniqUITests

destinations: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -showdestinations

clean: project
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) clean
