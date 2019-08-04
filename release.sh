#!/bin/sh
help() {
    echo "$0 [OPTIONS]"
    echo "    -h         도움말"
    echo "    -v ARG     커스텀 버전 지정"
    echo "    -m         MAJOR 버전 자동 증가"
    echo "    -n         MINOR 버전 자동 증가"
    echo "    -b         BUILD 버전 자동 증가 <기본 설정>"
    exit 0
}

MAJOR=`git describe --tags master | cut -d . -f1`
MINOR=`git describe --tags master | cut -d . -f2`
BUILD=`git describe --tags master | cut -d . -f3`
RELEASE_VERSION=$(( $MAJOR )).$(( $MINOR )).$(( $BUILD + 1 ))

while getopts "v:mnbh" opt
do
  case $opt in
    v)
      RELEASE_VERSION=$OPTARG
      ;;
    m)
      RELEASE_VERSION=$(( $MAJOR + 1 )).$(( $MINOR )).$(( $BUILD ))
      ;;
    n)
      RELEASE_VERSION=$(( $MAJOR )).$(( $MINOR + 1)).$(( $BUILD ))
      ;;
    b)
      RELEASE_VERSION=$(( $MAJOR )).$(( $MINOR )).$(( $BUILD + 1 ))
      ;;
    h) help ;;
    ?) help ;;
  esac
done


echo "=========================================================="
echo " Start release: $RELEASE_VERSION"
echo "=========================================================="

git checkout develop && \
	git pull && \
	git flow release start ${RELEASE_VERSION} && \
	sed -ri "s/\"version\": \"[^\"]+\"/\"version\": \"${RELEASE_VERSION}\"/g" nodejs/package.json && \
	git ci -a -m "릴리즈 버전 ${RELEASE_VERSION} 적용" && \
	GIT_MERGE_AUTOEDIT=no git flow release finish -m "Finish ${RELEASE_VERSION}" -s -p && \
	git checkout master && \
	./deploy.sh && \
	git checkout develop
