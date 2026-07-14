<?php
namespace App\Traits;

use Illuminate\Http\Response;
trait ApiResponser{

/**
 *
 */
  public function successResponse($data, $code= Response::HTTP_OK){
    return response()->json(['data'=>$data],$code);
  }


/**
 *
 */
  public function erroResponse($mesage, $code){
    return response()->json(['error'=>$mesage,'code'=>$code],$code);
  }
}
