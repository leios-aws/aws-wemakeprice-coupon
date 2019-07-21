#!/bin/sh
NAME=$(basename $(realpath .))
REVISION=$(git describe --all | cut -d '/' -f 2)

rm -f ${NAME}.zip

case ${REVISION} in
    *develop*)
        cd nodejs && \
            zip -r ../${NAME}.zip . -x node_modules\* && \
            cd .. && \
            aws lambda update-function-code --function-name ${NAME} --zip-file fileb://${NAME}.zip
        ;;
    *)
        cd nodejs && \
            zip -r ../${NAME}.zip . -x node_modules\* && \
            cd .. && \
            aws lambda update-function-code --function-name ${NAME} --zip-file fileb://${NAME}.zip && \
            VERSION=$(aws lambda publish-version --function-name ${NAME} | jq -r .Version) && \
            aws lambda update-alias --function-name ${NAME} --function-version ${VERSION} --name service
        ;;
esac
