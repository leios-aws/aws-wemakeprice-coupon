#!/bin/sh

CACHE_FILE=~/.aws/lambda-role.arn
if [ -z "$1" ]
then
  if [ -f ${CACHE_FILE} ]
  then
    ROLE=`cat ${CACHE_FILE}`
  else
    echo "Usage: $0 <Role arn:aws:iam::....:....>"
    exit 1
  fi
else
  mkdir -p ~/.aws
  echo $1 > ${CACHE_FILE}
  ROLE=$1
fi

rm -f ${NAME}.zip ${NAME}-modules.zip

NAME=$(basename $(realpath .))
zip -r ${NAME}-modules.zip nodejs/node_modules && \
    LAYER_VERSION=$(aws lambda publish-layer-version --layer-name ${NAME}-modules --zip-file fileb://${NAME}-modules.zip | jq -r .LayerVersionArn) && \
    cd nodejs && zip -r ../${NAME}.zip . -x node_modules\* && cd .. && \
    aws lambda create-function --function-name ${NAME} --zip-file fileb://${NAME}.zip --handler index.handler --runtime nodejs10.x --role ${ROLE} --timeout 30 --layers ${LAYER_VERSION} --environment Variables="{}" && \
    aws lambda create-alias --function-name ${NAME} --name service --function-version \$LATEST
