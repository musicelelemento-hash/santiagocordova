<?php
namespace App\Traits;

use GuzzleHttp\Client;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
/**
 *
 */
trait ConsumesExternalService
{

  /**
   * send a post request to any service
   * @return string
   */
  public function performPostRequest($requestUrl,$formParams=[],$headers=[])
  {
    try {
     // return $this->baseUrl.$requestUrl;
      //return $formParams;
      if(isset($this->secret)){
         $headers['Authorization']=$this->secret;
      }
      $headers["Content-Type"]="application/json";
      $client = Http::retry(3, 100)->withHeaders($headers);
      if (app()->environment('local')) {
        $client = $client->withoutVerifying();
      }
      $response = $client->post($this->baseUrl.$requestUrl, $formParams);
      return $response->json();

    } catch (\Throwable $th) {
      
      return response()->json(["status"=>false,"message"=>$th->getMessage()])->setStatusCode(Response::HTTP_INTERNAL_SERVER_ERROR);
    }
    
  }
/**
   * send a get request to any service
   * @return string
   */
  public function performGetRequest($requestUrl,$headers=[]){
    try {

      //return $this->baseUrl.$requestUrl;
      if(isset($this->secret)){

        //return $this->baseUrl.$requestUrl;
        $headers['Authorization']=$this->secret;
      }
      $headers["Content-Type"]="application/json";
      return$response = Http::retry(3, 100)->withHeaders($headers)->get($this->baseUrl.$requestUrl);
      return $response->json();
    } catch (\Throwable $th) {
      return response()->json(["status"=>false,"message"=>$th->getMessage()]);
    }
  }


  public function performGetRequestXml($requestUrl,$headers=[]){
    try {

      //return $this->baseUrl.$requestUrl;
      if(isset($this->secret)){

        //return $this->baseUrl.$requestUrl;
        $headers['Authorization']=$this->secret;
      }
      $headers["Content-Type"]="application/json";
      return$response = Http::retry(3, 100)->withHeaders($headers)->get($this->baseUrl.$requestUrl);

    } catch (\Throwable $th) {
      return response()->json(["status"=>false,"message"=>$th->getMessage()]);
    }
  }
  public function performGetRequestGeneric($url,$headers=[]){
    try {
      if(isset($this->secret)){

        //return $this->baseUrl.$requestUrl;
        $headers['Authorization']=$this->secret;
      }
      $response = Http::retry(3, 100)->withHeaders($headers)->get($url);
      return $response->json();
    } catch (\Throwable $th) {
      return response()->json(["status"=>false,"message"=>$th->getMessage()]);
    }
  }







}