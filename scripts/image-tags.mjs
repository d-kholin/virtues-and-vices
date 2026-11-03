import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function imageTags({repository,branch,sha,runNumber}) {
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository||''))throw Error('Invalid repository.');
  if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Invalid commit SHA.');
  const image='ghcr.io/'+repository.toLowerCase();
  let names;
  if(branch==='main') {
    if(!/^[1-9]\d*$/.test(String(runNumber)))throw Error('Invalid workflow run number.');
    names=['1.'+runNumber,'1'];
  } else {
    const tag=String(branch||'').toLowerCase().replace(/[^a-z0-9_.-]+/g,'-').replace(/^[.-]+/,'').slice(0,128);
    if(!tag||/^(?:latest|main|1(?:\.\d+)*|sha-.*)$/.test(tag))throw Error('Branch name maps to a reserved release or SHA tag; rename the branch.');
    names=[tag];
  }
  names.push('sha-'+sha.slice(0,12));
  return {image,tags:names.map(tag=>image+':'+tag)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {image,tags}=imageTags({repository:process.env.GITHUB_REPOSITORY,branch:process.env.GITHUB_REF_NAME,sha:process.env.GITHUB_SHA,runNumber:process.env.GITHUB_RUN_NUMBER});
  const output=`image=${image}\ntags<<VV_TAGS\n${tags.join('\n')}\nVV_TAGS\n`;
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,output);
  console.log(tags.join('\n'));
}
