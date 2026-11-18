import {domains,documentTemplates,imageTemplates} from './catalog.js';
import {exampleDocument} from './documents.js';
import {exampleImage} from './images.js';
import {materialsRequest} from './render.js';
export async function materialsDemo(){
  const requests=[];
  for(const domain of domains){const t=documentTemplates.find(t=>t.domain===domain.id);requests.push(await materialsRequest('documents',exampleDocument(t.id)));}
  for(const t of imageTemplates)requests.push(await materialsRequest('images',exampleImage(t.id)));
  return {schema_version:'material-batch/1',batch_id:'demo-documents-images-v1',name:'七类文书与四类图片示例',documents:requests.flatMap(r=>r.documents)};
}
