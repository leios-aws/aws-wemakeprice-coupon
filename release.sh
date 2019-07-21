#!/bin/sh

if [ -z "$1" ]
then
  CUR=`git describe --tags master | cut -d . -f1`
  RELEASE_VERSION=$(( $CUR + 1 )).0.0
else 
  RELEASE_VERSION=$1
fi

echo "=========================================================="
echo " Start release: $RELEASE_VERSION"
echo "=========================================================="

git checkout develop && \
	git pull && \
	git flow release start ${RELEASE_VERSION} && \
	sed -ri "s/\"version\": \"[^\"]+\"/\"version\": \"${RELEASE_VERSION}\"/g" nodejs/package.json && \
	git ci -a -m "릴리즈 버전 ${RELEASE_VERSION} 적용" && \
	GIT_MERGE_AUTOEDIT=no git flow release finish -m "Finish ${RELEASE_VERSION}" ${RELEASE_VERSION} -p && \
	git checkout master && \
	./deploy.sh && \
	git checkout develop
